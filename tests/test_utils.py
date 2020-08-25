from django.conf import settings
from django.test import TestCase

from s3upload.utils import get_s3_path_from_url


class UtilTests(TestCase):
    def test_get_s3_path_from_url(self):
        path = "folder1/folder2/file1.json"
        test_s3_url_1 = "s3://{0}/folder1/folder2/file1.json".format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_2 = "https://{0}.s3-aws-region.amazonaws.com/folder1/folder2/file1.json?test=1&test1=2".format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_3 = "https://{0}.s3.amazonaws.com:443/folder1/folder2/file1.json".format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_4 = "https://s3-aws-region.amazonaws.com/{0}/folder1/folder2/file1.json".format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_5 = "https://s3-aws-region.amazonaws.com:443/{0}/folder1/folder2/file1.json".format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_6 = "https%3a%2f%2fs3-aws-region.amazonaws.com%3a443%2f{0}%2ffolder1%2ffolder2%2ffile1.json".format(
            settings.AWS_STORAGE_BUCKET_NAME
        )

        test_1 = get_s3_path_from_url(test_s3_url_1)
        self.assertEqual(test_1, path)

        test_2 = get_s3_path_from_url(test_s3_url_2)
        self.assertEqual(test_2, path)

        test_3 = get_s3_path_from_url(test_s3_url_3)
        self.assertEqual(test_3, path)

        test_4 = get_s3_path_from_url(test_s3_url_4)
        self.assertEqual(test_4, path)

        test_5 = get_s3_path_from_url(test_s3_url_5)
        self.assertEqual(test_5, path)

        test_6 = get_s3_path_from_url(test_s3_url_6)
        self.assertEqual(test_6, path)
