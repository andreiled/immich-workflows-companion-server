import assert from 'assert';
import { inferRawImageFileBasename } from '../../util/path.js';

describe('inferRawImageFileBasename', () => {
  it('drops the extension', () => {
    assert.strictEqual(inferRawImageFileBasename('DSC08675.jpg'), 'DSC08675');
  });

  describe('drops the tail after the file sequence number', () => {
    it('when separated by an underscore', () => {
        assert.strictEqual(inferRawImageFileBasename('DSC08675_post.jpg'), 'DSC08675');
    });

    it('when separated by a space', () => {
        assert.strictEqual(inferRawImageFileBasename('DSC08883 Beavers hut.jpg'), 'DSC08883');
    });
  });
});
