import type { ImagePickerAsset } from 'expo-image-picker';
import { processPhoto, resizeSpec, takenAtFromExif } from './processPhoto';

// A fake native manipulator (#53). It models the two things processPhoto leans
// on — `manipulate()` decodes whatever source it is handed, and a render carries
// its resulting dimensions forward — and labels every decode by what it read.
// Decoding the original twice is the wasted work this ticket is about, so the
// label is the assertion. It is not a memory claim: the two decodes were always
// sequential, and the peak is owned by EntryFormScreen's Promise.all (#69).
type FakeSize = { width: number; height: number };
type FakeRef = FakeSize & {
  label: string;
  released: boolean;
  extendedRange: boolean;
  saveAsync: (o: FakeSaveOptions) => Promise<FakeResult>;
  release: () => void;
};
type FakeSaveOptions = { format: string; compress: number };
type FakeResult = FakeSize & { uri: string };

const mockDecodes: string[] = [];
const mockSaves: (FakeSaveOptions & FakeSize)[] = [];
const mockReleases: string[] = [];
// What the file actually decodes to, which an ImagePickerAsset's declared
// width/height does not always match (EXIF orientation 6/8 transposes them).
// Kept separate from the declared size so a test can make them disagree.
let mockSourceSize: FakeSize = { width: 0, height: 0 };
// The real resize draws through UIGraphicsImageRenderer, which hands back a
// 16-bit extended-range bitmap for a wide-color (Display P3) source, and every
// manipulate() then fails to build its orientation context on it (#87).
let mockWideColor = false;
// What each saved file decodes to, so a decode of a saved render is honest.
const mockFiles = new Map<string, FakeSize>();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate(source: string | FakeRef) {
      if (typeof source !== 'string' && source.released) {
        throw new Error(`manipulate on released ${source.label}`);
      }
      if (typeof source !== 'string' && source.extendedRange) {
        throw new Error('ImageContextLostException: Image context has been lost');
      }
      const label = typeof source === 'string' ? source : source.label;
      mockDecodes.push(label);
      let size: FakeSize =
        typeof source === 'string'
          ? { ...(mockFiles.get(source) ?? mockSourceSize) }
          : { width: source.width, height: source.height };
      let resized = false;
      const context = {
        resize({ width, height }: { width?: number; height?: number }) {
          resized = true;
          const scale = width ? width / size.width : height! / size.height;
          size = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
          return context;
        },
        async renderAsync(): Promise<FakeRef> {
          const rendered: FakeRef = {
            label: `render(${label})`,
            width: size.width,
            height: size.height,
            released: false,
            extendedRange: mockWideColor && resized,
            async saveAsync(options: FakeSaveOptions) {
              // The real SharedObject throws on any call after release().
              if (rendered.released) throw new Error(`saveAsync on released ${rendered.label}`);
              mockSaves.push({ ...options, width: rendered.width, height: rendered.height });
              const uri = `file:///cache/${mockSaves.length}.jpg`;
              mockFiles.set(uri, { width: rendered.width, height: rendered.height });
              return { uri, width: rendered.width, height: rendered.height };
            },
            release() {
              rendered.released = true;
              mockReleases.push(rendered.label);
            },
          };
          return rendered;
        },
      };
      return context;
    },
  },
}));

const ORIGINAL = 'file:///DCIM/IMG_0001.HEIC';

/**
 * `declared` is what the picker reports; `decoded` is what the file really is.
 * They differ for EXIF-orientation 6/8 photos, so passing both is how a test
 * proves which one a resize was specced from.
 */
function pickerAsset(
  declared: FakeSize,
  options: { exif?: Record<string, unknown>; decoded?: FakeSize; wideColor?: boolean } = {},
): ImagePickerAsset {
  mockSourceSize = options.decoded ?? declared;
  mockWideColor = options.wideColor ?? false;
  return { uri: ORIGINAL, ...declared, exif: options.exif } as unknown as ImagePickerAsset;
}

const longEdges = () => mockSaves.map((s) => Math.max(s.width, s.height));

beforeEach(() => {
  mockDecodes.length = 0;
  mockSaves.length = 0;
  mockReleases.length = 0;
  mockSourceSize = { width: 0, height: 0 };
  mockWideColor = false;
  mockFiles.clear();
});

describe('processPhoto', () => {
  it('decodes the original once, deriving the thumbnail from the saved full render', async () => {
    await processPhoto(pickerAsset({ width: 6000, height: 4000 }));

    // The file once, as-is (#70); the full render from that bitmap; the thumb
    // from the full render's saved JPEG (#87).
    expect(mockDecodes).toEqual([ORIGINAL, `render(${ORIGINAL})`, 'file:///cache/1.jpg']);
  });

  it('caps the full render at 3500px and the thumbnail at 400px, either orientation', async () => {
    await processPhoto(pickerAsset({ width: 6000, height: 4000 }));
    expect(longEdges()).toEqual([3500, 400]);

    mockSaves.length = 0;
    await processPhoto(pickerAsset({ width: 4000, height: 6000 }));
    expect(longEdges()).toEqual([3500, 400]);
  });

  it('never upscales, at either size', async () => {
    await processPhoto(pickerAsset({ width: 320, height: 240 }));

    expect(mockSaves.map((s) => [s.width, s.height])).toEqual([
      [320, 240],
      [320, 240],
    ]);
  });

  it('releases every render, each after its last use', async () => {
    await processPhoto(pickerAsset({ width: 6000, height: 4000 }));

    // Deriving the thumb from the full render keeps the full's bitmap reachable
    // across that decode, so neither ref may be left to the GC (#53). The fake
    // throws on use-after-release, so a release moved too early fails here too.
    expect(mockReleases).toEqual([
      `render(${ORIGINAL})`,
      `render(render(${ORIGINAL}))`,
      'render(file:///cache/1.jpg)',
    ]);
    expect(mockSaves).toHaveLength(2);
  });

  it('specs the thumbnail from the decoded render, not the asset’s declared size', async () => {
    // An EXIF-orientation 6/8 photo: the picker reports the dimensions
    // transposed against what the file decodes to. Reading the thumb's cap off
    // the asset instead of off the full render puts the long edge on the wrong
    // axis, which is invisible when declared and decoded agree.
    await processPhoto(
      pickerAsset({ width: 4000, height: 3000 }, { decoded: { width: 3000, height: 4000 } }),
    );

    const [, thumb] = mockSaves;
    expect([thumb.width, thumb.height]).toEqual([300, 400]);
  });

  it('caps the full render on the decoded size, not the asset’s declared size (#70)', async () => {
    // Declared landscape, decodes portrait: speccing off the asset resizes the
    // width to 3500 and leaves a 4667px long edge.
    await processPhoto(
      pickerAsset({ width: 8064, height: 6048 }, { decoded: { width: 6048, height: 8064 } }),
    );
    expect([mockSaves[0].width, mockSaves[0].height]).toEqual([2625, 3500]);
  });

  it('never upscales the full render when declared and decoded are transposed (#70)', async () => {
    // Declared portrait, decodes 4000×3000: speccing off the asset sets the
    // height to 3500, an upscale on both axes.
    await processPhoto(
      pickerAsset({ width: 3000, height: 4000 }, { decoded: { width: 4000, height: 3000 } }),
    );
    expect([mockSaves[0].width, mockSaves[0].height]).toEqual([3500, 2625]);
  });

  it('attaches a wide-color photo, never re-manipulating a resized render (#87)', async () => {
    // IMG_3630.HEIC from an iPhone 17 Pro: a 48MP Display P3 portrait. Deriving
    // the thumb from the full render's ref threw, and the attach did nothing.
    await processPhoto(
      pickerAsset({ width: 6048, height: 8064 }, { wideColor: true }),
    );

    expect(mockSaves.map((s) => [s.width, s.height])).toEqual([
      [2625, 3500],
      [300, 400],
    ]);
  });

  it('returns both saved URIs and the capture time, and re-encodes as fresh JPEGs', async () => {
    const result = await processPhoto(
      pickerAsset(
        { width: 6000, height: 4000 },
        { exif: { DateTimeOriginal: '2026:08:19 15:04:05', GPSLatitude: 25.03 } },
      ),
    );

    expect(result.fullUri).toBe('file:///cache/1.jpg');
    expect(result.thumbUri).toBe('file:///cache/2.jpg');
    expect(result.takenAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    // EXIF stripping is a side effect of writing a fresh JPEG, so both saves
    // must go through the encoder — nothing copies the original's bytes.
    expect(mockSaves.map((s) => s.format)).toEqual(['jpeg', 'jpeg']);
    expect(mockSaves.map((s) => s.compress)).toEqual([0.85, 0.85]);
  });
});

describe('takenAtFromExif', () => {
  it('converts EXIF DateTimeOriginal to RFC3339', () => {
    const iso = takenAtFromExif({ DateTimeOriginal: '2026:08:19 15:04:05' });
    // Local-time EXIF → UTC instant; only shape and round-trip stability matter.
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(new Date(iso!).getTime()).toBe(new Date(2026, 7, 19, 15, 4, 5).getTime());
  });

  it('ignores missing or malformed EXIF and never reads GPS', () => {
    expect(takenAtFromExif(undefined)).toBeUndefined();
    expect(takenAtFromExif({})).toBeUndefined();
    expect(takenAtFromExif({ DateTimeOriginal: 'not a date' })).toBeUndefined();
    expect(takenAtFromExif({ GPSLatitude: 25.03, DateTime: '2026:01/02' })).toBeUndefined();
  });
});

describe('resizeSpec', () => {
  it('caps the longest edge and never upscales', () => {
    expect(resizeSpec(6000, 4000, 3500)).toEqual({ width: 3500 });
    expect(resizeSpec(3000, 5200, 3500)).toEqual({ height: 3500 });
    expect(resizeSpec(3000, 2000, 3500)).toBeNull();
  });
});
