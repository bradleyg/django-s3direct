import hashlib
import uuid
import hmac
import json
from datetime import datetime, timedelta
from base64 import b64encode

from django.conf import settings


S3DIRECT_UNIQUE_RENAME = getattr(settings, 'S3DIRECT_UNIQUE_RENAME', None)


def create_upload_data(content_type, source_filename, upload_to):
    access_key = settings.AWS_ACCESS_KEY_ID
    secret_access_key = settings.AWS_SECRET_ACCESS_KEY
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    endpoint = settings.S3DIRECT_ENDPOINT

    expires_in = datetime.now() + timedelta(hours=5)
    expires = expires_in.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    policy_object = json.dumps({
        "expiration": expires,
        "conditions": [
            {"bucket": bucket},
            {"acl": "public-read"},
            {"Content-Type": content_type},
            ["starts-with", "$key", ""],
            {"success_action_status": "201"}
        ]
    })

    policy = b64encode(
        policy_object.replace('\n', '').replace('\r', '').encode())

    signature = hmac.new(
        secret_access_key.encode(), policy, hashlib.sha1).digest()

    signature_b64 = b64encode(signature)

    if S3DIRECT_UNIQUE_RENAME:
        ext = source_filename.split('.')[-1]
        filename = '%s.%s' % (uuid.uuid4(), ext)
    else:
        filename = '${filename}'

    key = '%s/%s' % (upload_to, filename)
    bucket_url = 'https://%s/%s' % (endpoint, bucket)

    return {
        "policy": policy.decode(),
        "signature": signature_b64.decode(),
        "key": key,
        "AWSAccessKeyId": access_key,
        "form_action": bucket_url,
        "success_action_status": "201",
        "acl": "public-read",
        "Content-Type": content_type
    }
