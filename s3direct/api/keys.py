import os
import uuid
from datetime import datetime


def get_random_filename(filename) -> str:
    """Get random filename.

    Generation random filename that contains unique identifier and
    filename extension like: ``photo.jpg``.

    If extension is too long (we had issue with that), replace it with
    special ".extension".

    Args:
        filename (str): Name of file.

    Returns:
        new_filename (str): ``9841422d-c041-45a5-b7b3-467179f4f127.ext``.

    """
    path = str(uuid.uuid4())
    ext = os.path.splitext(filename)[1]
    if len(ext) > 15:
        ext = '.incorrect'

    return ''.join([path, ext.lower()])


class S3PrefixedKey(object):
    """Key generator for multiple file uploads.

    This generator return key that has "$" in the end that allow making
    multiple file uploads using same policy.
    """
    def __call__(self, filename=None) -> str:
        """Call method for key."""
        return 'uploads/{date}/{salt}/'.format(
            date=datetime.now().strftime('%Y/%m/%d'),
            salt=uuid.uuid4()
        )


class S3KeyWithUUID(object):
    """Prefixed key generator with UUID file name."""
    def __init__(self, prefix):
        self.prefix = prefix

    def __call__(self, filename) -> str:
        """Return prefixed S3 key."""
        return f'{self.prefix}{get_random_filename(filename)}'
