import hashlib
import hmac
import json
from datetime import datetime, timedelta
from base64 import b64encode

from django.conf import settings


REGIONS = {
    'us-east-1': 's3.amazonaws.com',
    'us-west-2': 's3-us-west-2.amazonaws.com',
    'us-west-1': 's3-us-west-1.amazonaws.com',
    'eu-west-1': 's3-eu-west-1.amazonaws.com',
    'eu-central-1': 's3.eu-central-1.amazonaws.com',
    'ap-southeast-1': 's3-ap-southeast-1.amazonaws.com',
    'ap-southeast-2': 's3-ap-southeast-2.amazonaws.com',
    'ap-northeast-1': 's3-ap-northeast-1.amazonaws.com',
    'sa-east-1': 's3-sa-east-1.amazonaws.com',
}


def get_at(index, t):
    try:
        value = t[index]
    except IndexError:
        value = None
    return value


def create_upload_data(content_type, key, acl, bucket=None, cache_control=None, content_disposition=None):
    access_key = settings.AWS_ACCESS_KEY_ID
    secret_access_key = settings.AWS_SECRET_ACCESS_KEY
    bucket = bucket or settings.AWS_STORAGE_BUCKET_NAME
    region = getattr(settings, 'S3DIRECT_REGION', None)
    endpoint = REGIONS.get(region, 's3.amazonaws.com')

    expires_in = datetime.utcnow() + timedelta(seconds=60*5)
    expires = expires_in.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    now_date = datetime.utcnow().strftime('%Y%m%dT%H%M%S000Z')
    raw_date = datetime.utcnow().strftime('%Y%m%d')

    policy_dict = {
            "expiration": expires,
            "conditions": [
                {"bucket": bucket},
                {"acl": acl},
                ["starts-with", "$key", ''],
                {"success_action_status": '201'},
                {"x-amz-credential": '%s/%s/%s/s3/aws4_request' % (access_key, raw_date, region)},
                {"x-amz-algorithm": "AWS4-HMAC-SHA256"},
                {"x-amz-date": now_date},
                {"content-type": content_type},
            ]
        }

    if cache_control:
        policy_dict['conditions'].append({'Cache-Control': cache_control})

    if content_disposition:
        policy_dict['conditions'].append({'Content-Disposition': content_disposition})

    policy_object = json.dumps(policy_dict)

    policy = b64encode(
        policy_object.replace('\n', '').replace('\r', '').encode())

    date_key = hmac.new('AWS4' + secret_access_key, msg=raw_date, digestmod=hashlib.sha256).digest()
    date_region_key = hmac.new(date_key, msg=region, digestmod=hashlib.sha256).digest()
    date_region_service_key = hmac.new(date_region_key, msg='s3', digestmod=hashlib.sha256).digest()
    signing_key = hmac.new(date_region_service_key, msg='aws4_request', digestmod=hashlib.sha256).digest()

    signature = hmac.new(signing_key, msg=policy, digestmod=hashlib.sha256).hexdigest()

    structure = getattr(settings, 'S3DIRECT_URL_STRUCTURE', 'https://{1}.{0}')
    bucket_url = structure.format(endpoint, bucket)

    return_dict = {
        "policy": policy,
        "success_action_status": 201,
        "x-amz-credential": "%s/%s/%s/s3/aws4_request" % (access_key, raw_date, region),
        "x-amz-date": now_date,
        "x-amz-signature": signature,
        "x-amz-algorithm": "AWS4-HMAC-SHA256",
        "form_action": bucket_url,
        "key": key,
        "acl": acl,
        "content-type": content_type
    }

    if cache_control:
        return_dict['Cache-Control'] = cache_control

    if content_disposition:
        return_dict['Content-Disposition'] = content_disposition

    return return_dict
