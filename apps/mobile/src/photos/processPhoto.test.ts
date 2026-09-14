import type { ImagePickerAsset } from 'expo-image-picker';
import { processPhoto, resizeSpec, takenAtFromExif } from './processPhoto';

// A fake native manipulator (#53). It models the two things processPhoto leans
// on — `manipulate()` decodes whatever source it is handed, and a render carries
// its resulting dimensions forward — and labels every decode by what it read.
// Decoding the original twice is both the memory cost this ticket is about and
// the one route by which EXIF could come back, so the label is the assertion.
type FakeSize = { width: number; height: number };
type FakeRef = FakeSize & { label: string; saveAsync: (o: FakeSaveOptions) => Promise<FakeResult> };
type FakeSaveOptions = { format: string; compress: number };
type FakeResult = FakeSize & { uri: string };

const mockDecodes: string[] = [];
const mockSaves: (FakeSaveOptions & FakeSize)[] = [];
const mockSourceSizes: Record<string, FakeSize> = {};

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate(source: string | FakeRef) {
      const label = typeof source === 'string' ? source : source.label;
      mockDecodes.push(label);
      let size: FakeSize =
        typeof source === 'string'
          ? { ...mockSourceSizes[source] }
          : { width: source.width, height: source.height };
      const context = {
        resize({ width, height }: { width?: number; height?: number }) {
          const scale = width ? width / size.width : height! / size.height;
          size = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
          return context;
        },
        async renderAsync(): Promise<FakeRef> {
          const rendered: FakeRef = {
            label: `render(${label})`,
            width: size.width,
            height: size.height,
            async saveAsync(options: FakeSaveOptions) {
              mockSaves.push({ ...options, width: rendered.width, height: rendered.height });
              return { uri: `file:///cache/${mockSaves.length}.jpg`, width: rendered.width, height: rendered.height };
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

function pickerAsset(size: FakeSize, exif?: Record<string, unknown>): ImagePickerAsset {
  mockSourceSizes[ORIGINAL] = size;
  return { uri: ORIGINAL, ...size, exif } as unknown as ImagePickerAsset;
}

const longEdges = () => mockSaves.map((s) => Math.max(s.width, s.height));

beforeEach(() => {
  mockDecodes.length = 0;
  mockSaves.length = 0;
});

describe('processPhoto', () => {
  it('decodes the original once, deriving the thumbnail from the full render', async () => {
    await processPhoto(pickerAsset({ width: 6000, height: 4000 }));

    expect(mockDecodes).toEqual([ORIGINAL, `render(${ORIGINAL})`]);
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

  it('returns both saved URIs and the capture time, and re-encodes as fresh JPEGs', async () => {
    const result = await processPhoto(
      pickerAsset({ width: 6000, height: 4000 }, { DateTimeOriginal: '2026:08:19 15:04:05', GPSLatitude: 25.03 }),
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
