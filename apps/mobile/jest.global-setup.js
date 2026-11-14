// Every test file runs in UTC, on a Mac or on CI. Set here, before the
// workers start, because a test file's process.env is a copy: assigning TZ
// inside one never reaches Node's clock (#147).
module.exports = () => {
  process.env.TZ = 'UTC';
};
