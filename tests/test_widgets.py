import json
from base64 import b64decode
from urllib.parse import parse_qs, urlparse

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
from django.test.utils import override_settings
from django.urls import resolve, reverse

from s3upload import widgets

HTML_OUTPUT = """<div class="s3upload" data-policy-url="/s3upload/get_upload_params/">
    <a class="s3upload__file-link" target="_blank" href=""></a>
    <a class="s3upload__file-remove" href="#remove">Remove</a>
    <input
        class="s3upload__file-url"
        type="hidden"
        value=""
        id=""
        name="filename"
    />
    <input class="s3upload__file-dest" type="hidden" value="foo" />
    <input class="s3upload__file-input" type="file" style="" />
    <div class="s3upload__error"></div>
    <div class="s3upload__progress active">
        <div class="s3upload__bar"></div>
    </div>
</div>
"""

FOO_RESPONSE = {
    "x-amz-algorithm": "AWS4-HMAC-SHA256",
    "form_action": "https://s3.amazonaws.com/{}".format(
        settings.AWS_STORAGE_BUCKET_NAME
    ),
    "success_action_status": 201,
    "acl": "public-read",
    "key": "uploads/imgs/image.jpg",
    "content-type": "image/jpeg",
}


class WidgetTests(TestCase):
    def setUp(self):
        admin = User.objects.create_superuser("admin", "u@email.com", "admin")
        admin.save()

    def test_init(self):
        # Test initialising the widget without an invalid destination
        self.assertRaises(ImproperlyConfigured, widgets.S3UploadWidget, "foo")
        self.assertRaises(ValueError, widgets.S3UploadWidget, None)
        self.assertRaises(ValueError, widgets.S3UploadWidget, "")
        with override_settings(S3UPLOAD_DESTINATIONS={"foo": {}}):
            widgets.S3UploadWidget("foo")

    def test_check_urls(self):
        reversed_url = reverse("s3upload")
        resolved_url = resolve("/s3upload/get_upload_params/")
        self.assertEqual(reversed_url, "/s3upload/get_upload_params/")
        self.assertEqual(resolved_url.view_name, "s3upload")

    @override_settings(S3UPLOAD_DESTINATIONS={"foo": {}})
    def test_check_widget_html(self):
        widget = widgets.S3UploadWidget(dest="foo")
        html = widget.render("filename", None)
        self.assertEqual(html, HTML_OUTPUT)

    def test_check_signing_logged_in(self):
        self.client.login(username="admin", password="admin")
        data = {"dest": "files", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)

    def test_check_signing_logged_out(self):
        data = {"dest": "files", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 403)

    def test_check_allowed_type(self):
        data = {"dest": "imgs", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)

    def test_check_disallowed_type(self):
        data = {"dest": "imgs", "name": "image.mp4", "type": "video/mp4"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 400)

    def test_check_allowed_type_logged_in(self):
        self.client.login(username="admin", password="admin")
        data = {"dest": "vids", "name": "video.mp4", "type": "video/mp4"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)

    def test_check_disallowed_type_logged_out(self):
        data = {"dest": "vids", "name": "video.mp4", "type": "video/mp4"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 403)

    def test_check_disallowed_extensions(self):
        data = {"dest": "imgs", "name": "image.jfif", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 415)

    def test_check_allowed_extensions(self):
        data = {"dest": "imgs", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)

    def test_check_disallowed_extensions__uppercase(self):
        data = {"dest": "imgs", "name": "image.JFIF", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 415)

    def test_check_allowed_extensions__uppercase(self):
        data = {"dest": "imgs", "name": "image.JPG", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)

    def test_check_signing_fields(self):
        self.client.login(username="admin", password="admin")
        data = {"dest": "imgs", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]
        self.assertTrue("x-amz-signature" in aws_payload)
        self.assertTrue("x-amz-credential" in aws_payload)
        self.assertTrue("policy" in aws_payload)
        self.assertEqual(aws_payload["x-amz-algorithm"], "AWS4-HMAC-SHA256")
        self.assertEqual(
            aws_payload["form_action"],
            f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.S3UPLOAD_REGION}.amazonaws.com",
        )
        self.assertEqual(aws_payload["success_action_status"], 201)
        self.assertEqual(aws_payload["acl"], "public-read")
        self.assertEqual(aws_payload["key"], "uploads/imgs/image.jpg")
        self.assertEqual(aws_payload["content-type"], "image/jpeg")

    def test_check_signing_fields_unique_filename(self):
        data = {"dest": "misc", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]
        self.assertTrue("x-amz-signature" in aws_payload)
        self.assertTrue("x-amz-credential" in aws_payload)
        self.assertTrue("policy" in aws_payload)
        self.assertEqual(aws_payload["x-amz-algorithm"], "AWS4-HMAC-SHA256")
        self.assertEqual(
            aws_payload["form_action"],
            f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.S3UPLOAD_REGION}.amazonaws.com",
        )
        self.assertEqual(aws_payload["success_action_status"], 201)
        self.assertEqual(aws_payload["acl"], "public-read")
        self.assertEqual(aws_payload["key"], "images/unique.jpg")
        self.assertEqual(aws_payload["content-type"], "image/jpeg")

    def test_check_policy_conditions(self):
        self.client.login(username="admin", password="admin")
        data = {"dest": "cached", "name": "video.mp4", "type": "video/mp4"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)
        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]
        self.assertTrue("policy" in aws_payload)
        policy_dict = json.loads(b64decode(aws_payload["policy"]).decode("utf-8"))
        self.assertTrue("conditions" in policy_dict)
        conditions_dict = policy_dict["conditions"]
        self.assertEqual(conditions_dict[0]["bucket"], "astoragebucketname")
        self.assertEqual(conditions_dict[1]["acl"], "authenticated-read")
        self.assertEqual(conditions_dict[8]["Cache-Control"], "max-age=2592000")
        self.assertEqual(conditions_dict[9]["Content-Disposition"], "attachment")
        self.assertEqual(conditions_dict[10]["x-amz-server-side-encryption"], "AES256")

    @override_settings(
        S3UPLOAD_DESTINATIONS={
            "misc": {
                "key": "/",
                "auth": lambda u: True,
                "acl": "private",
                "bucket": "test-bucket",
            }
        }
    )
    def test_check_signed_url(self):
        data = {"dest": "misc", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        response_dict = json.loads(response.content.decode())
        parsed_url = urlparse(response_dict["private_access_url"])
        parsed_qs = parse_qs(parsed_url.query)
        self.assertEqual(parsed_url.scheme, "https")
        self.assertEqual(parsed_url.netloc, "test-bucket.s3.amazonaws.com")
        self.assertTrue("Signature" in parsed_qs)
        self.assertTrue("Expires" in parsed_qs)

    def test_content_length_range(self):
        # Content_length_range setting is always sent as part of policy.
        # Initial request data doesn't affect it.
        data = {"dest": "imgs", "name": "image.jpg", "type": "image/jpeg"}
        response = self.client.post(reverse("s3upload"), data)
        self.assertEqual(response.status_code, 200)

        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]

        self.assertTrue("policy" in aws_payload)
        policy_dict = json.loads(b64decode(aws_payload["policy"]).decode("utf-8"))
        self.assertTrue("conditions" in policy_dict)
        conditions_dict = policy_dict["conditions"]
        self.assertEqual(conditions_dict[-1], ["content-length-range", 5000, 20000000])
