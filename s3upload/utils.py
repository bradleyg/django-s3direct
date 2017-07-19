import hashlib
import hmac
import json
from datetime import datetime, timedelta
from base64 import b64encode

import boto
from boto.s3.connection import S3Connection
from boto.s3.key import Key
from six.moves.urllib.parse import urlparse, unquote, parse_qs, urlencode

from django.conf import settings


class KeyNotFoundException(Exception):
    pass


def get_at(index, t):
    try:
        value = t[index]
    except IndexError:
        value = None
    return value


# NOTE: Don't use constant as it will break ability to change at runtime
# (E.g. tests)
def get_s3upload_destinations():
    """Returns s3upload destinations, converting old format if necessary."""
    destinations = getattr(settings, 'S3UPLOAD_DESTINATIONS', None)
    if destinations is None:
        return None

    # TODO: Remove when older "positional" settings are no longer supported
    converted_destinations = {}
    key_mapping = {
        0: 'key',
        1: 'auth',
        2: 'allowed',
        3: 'acl',
        4: 'bucket',
        5: 'cache_control',
        6: 'content_disposition',
        7: 'server_side_encryption',
    }
    if destinations:
        for dest, dest_value in destinations.items():
            if type(dest_value) is tuple or type(dest_value) is list:
                converted_destinations[dest] = {}
                for index, key_name in key_mapping.items():
                    converted_destinations[dest][key_name] = get_at(index, dest_value)
            else:
                converted_destinations[dest] = dest_value

    return converted_destinations


def create_upload_data(content_type, key, acl, bucket=None, cache_control=None,
                       content_disposition=None, content_length_range=None,
                       server_side_encryption=None, access_key=None,
                       secret_access_key=None, token=None):

    bucket = bucket or settings.AWS_STORAGE_BUCKET_NAME
    region = getattr(settings, 'S3UPLOAD_REGION', None)
    if not region or region == 'us-east-1':
        endpoint = 's3.amazonaws.com'
    else:
        endpoint = 's3-%s.amazonaws.com' % region
    expires_in = datetime.utcnow() + timedelta(seconds=60 * 5)
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
            {"x-amz-credential": '%s/%s/%s/s3/aws4_request' % (
                access_key,
                raw_date, region
            )},
            {"x-amz-algorithm": "AWS4-HMAC-SHA256"},
            {"x-amz-date": now_date},
            {"content-type": content_type},
        ]
    }

    if token:
        policy_dict["conditions"].append({"x-amz-security-token": token})

    if cache_control:
        policy_dict['conditions'].append({'Cache-Control': cache_control})

    if content_disposition:
        policy_dict['conditions'].append({
            'Content-Disposition': content_disposition
        })

    if server_side_encryption:
        policy_dict['conditions'].append(
            {'x-amz-server-side-encryption': server_side_encryption}
        )

    if content_length_range:
        policy_dict['conditions'].append(
            [
                'content-length-range',
                content_length_range[0],
                content_length_range[1]
            ]
        )

    policy_object = json.dumps(policy_dict)

    policy = b64encode(
        policy_object.replace('\n', '').replace('\r', '').encode())

    date_key = hmac.new(b'AWS4' + secret_access_key.encode('utf-8'),
                        msg=raw_date.encode('utf-8'),
                        digestmod=hashlib.sha256).digest()

    date_region_key = hmac.new(date_key, msg=region.encode('utf-8'),
                               digestmod=hashlib.sha256).digest()

    date_region_service_key = hmac.new(date_region_key, msg=b's3',
                                       digestmod=hashlib.sha256).digest()

    signing_key = hmac.new(date_region_service_key, msg=b'aws4_request',
                           digestmod=hashlib.sha256).digest()

    signature = hmac.new(signing_key, msg=policy,
                         digestmod=hashlib.sha256).hexdigest()

    structure = getattr(settings, 'S3UPLOAD_URL_STRUCTURE', 'https://{0}/{1}')
    bucket_url = structure.format(endpoint, bucket)

    return_dict = {
        # FIXME: .decode() does nothing, b64decode works but is decoding
        # really intended?
        "policy": policy.decode(),
        "success_action_status": 201,
        "x-amz-credential": "%s/%s/%s/s3/aws4_request" % (
            access_key, raw_date, region
        ),
        "x-amz-date": now_date,
        "x-amz-signature": signature,
        "x-amz-algorithm": "AWS4-HMAC-SHA256",
        "form_action": bucket_url,
        "key": key,
        "acl": acl,
        "content-type": content_type,
    }

    if token:
        return_dict['x-amz-security-token'] = token

    if server_side_encryption:
        return_dict['x-amz-server-side-encryption'] = server_side_encryption

    if cache_control:
        return_dict['Cache-Control'] = cache_control

    if content_disposition:
        return_dict['Content-Disposition'] = content_disposition

    return return_dict


def get_key_from_url(url, bucket_name=settings.AWS_STORAGE_BUCKET_NAME):
    conn = boto.connect_s3()
    bucket = conn.get_bucket(bucket_name)
    path = urlparse(url).path
    # The bucket name might be part of the path,
    # so get the path that comes after the bucket name
    path = path.split(bucket_name)[-1]
    return bucket.get_key(path)


def get_signed_download_url(
    source_url,
    bucket_name=settings.AWS_STORAGE_BUCKET_NAME,
    ttl=60,  # 60 seconds should be plenty for a redirected URL to load
):
    conn = S3Connection(
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
    )

    bucket = conn.get_bucket(bucket_name)
    k = Key(bucket)

    key_obj = get_key_from_url(unquote(source_url), bucket_name)

    try:
        k.key = key_obj.name
    except AttributeError:
        # key has no 'name' because it's not present in the bucket
        raise KeyNotFoundException

    download_url = k.generate_url(
        expires_in=ttl,
        query_auth=True
    )

    return download_url


def remove_signature(url):
    parsed_url = urlparse(url)
    query_vars = parse_qs(parsed_url.query)

    try:
        del query_vars["Signature"]
        del query_vars["Expires"]
        del query_vars["AWSAccessKeyId"]
    except KeyError:
        # Not a signed URL - return original string
        return url

    address_only = url.split("?")[0]

    if len(query_vars) > 0:
        return "{0}?{1}".format(
            address_only,
            urlencode(query_vars, doseq=True)
        )

    return address_only
