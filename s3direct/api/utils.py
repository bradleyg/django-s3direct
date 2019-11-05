import hashlib
import hmac
import json
from base64 import b64encode
from collections import namedtuple
from datetime import datetime, timedelta

from botocore.credentials import (InstanceMetadataFetcher,
                                  InstanceMetadataProvider)
from django.conf import settings
from django.http import HttpResponse

AWSCredentials = namedtuple(
    'AWSCredentials',
    ('access_key', 'secret_access_key', 'token'),
)


def get_s3direct_destinations() -> dict:
    """Return available destinations for S3 direct upload.

    Returns:
        dict: dictionary containing S3 direct upload destinations.

    """
    return getattr(settings, 'S3DIRECT_DESTINATIONS', None)


def get_aws_credentials() -> AWSCredentials:
    """Shortcut to get AWS credentials

    Try to get AWS credentials from settings or from instance profile (if we
    are running on EC2).

    Return:
        AWSCredentials(namedtuple): namedtuple which contains
            * access_key (string) - AWS access key id
            * secret_access_key (string) - AWS secret access key
            * token (string) - AWS session token

    """
    access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
    secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
    token = None

    if access_key is None or secret_access_key is None:
        provider = InstanceMetadataProvider(
            iam_role_fetcher=InstanceMetadataFetcher(
                timeout=1000,
                num_attempts=2
            )
        )
        credentials = provider.load()
        return AWSCredentials(
            access_key=credentials.access_key,
            secret_access_key=credentials.secret_key,
            token=credentials.token
        )

    return AWSCredentials(
        access_key=access_key,
        secret_access_key=secret_access_key,
        token=token
    )


def get_upload_params(dest, request, content_type=None, filename=None):
    """Overridden s3direct method

    Almost copied. Changed callable params, add custom expiration from policy
    """

    destination = get_s3direct_destinations().get(dest)

    if not destination:
        data = json.dumps({'error': 'File destination does not exist.'})
        return HttpResponse(data, content_type="application/json", status=400)

    key = destination.get('key')
    auth = destination.get('auth')
    allowed = destination.get('allowed') if content_type else tuple()
    acl = destination.get('acl')
    bucket = destination.get('bucket')
    cache_control = destination.get('cache_control')
    content_disposition = destination.get('content_disposition')
    content_length_range = destination.get('content_length_range')
    server_side_encryption = destination.get('server_side_encryption')
    extra_conditions = destination.get('extra_conditions')

    # is filename required for uploading using this destination.
    # If filename is not required, key should allow upload multiple files
    # using one signature
    filename_required = destination.get('filename_required', True)

    # add custom expiration time
    expires_in = destination.get('expires_in')

    if not acl:
        acl = 'public-read'

    if not key:
        data = json.dumps({'error': 'Missing destination path.'})
        return HttpResponse(data, content_type="application/json", status=403)

    if auth and not auth(request.user):
        data = json.dumps({'error': 'Permission denied.'})
        return HttpResponse(data, content_type="application/json", status=403)

    is_there_content_type = content_type
    is_not_everything_allowed = allowed != '*'
    is_content_type_not_allowed = allowed and content_type not in allowed
    is_file_not_valid = all((
        is_there_content_type,
        is_not_everything_allowed,
        is_content_type_not_allowed,
    ))
    if is_file_not_valid:
        data = json.dumps({'error': 'Invalid file type (%s).' % content_type})
        return HttpResponse(data, content_type="application/json", status=400)

    if filename_required and not filename:
        data = json.dumps(
            {'error': 'filename is required for this destination'}
        )
        return HttpResponse(data, content_type="application/json", status=403)

    if hasattr(key, '__call__'):
        key = key(filename)
    elif key == '/':
        key = '${filename}'
    else:
        # The literal string '${filename}' is an S3 field variable for key.
        # https://aws.amazon.com/articles/1434#aws-table
        key = '%s/${filename}' % key

    # if filename is optional "key" contain start condition for the key
    if filename_required:
        key_start = None
    else:
        key_start = key
        key = None

    access_key, secret_access_key, token = get_aws_credentials()
    if not all([access_key, secret_access_key]):
        return HttpResponse(content_type="application/json", status=500)

    data = create_upload_data(
        content_type=content_type,
        key=key,
        key_start=key_start,
        acl=acl,
        bucket=bucket,
        cache_control=cache_control,
        content_disposition=content_disposition,
        content_length_range=content_length_range,
        server_side_encryption=server_side_encryption,
        access_key=access_key,
        secret_access_key=secret_access_key,
        token=token,
        expires_in=expires_in,
        extra_conditions=extra_conditions
    )

    return HttpResponse(json.dumps(data), content_type="application/json")


def create_upload_data(
        content_type,
        acl,
        key=None,
        key_start=None,
        bucket=None,
        endpoint=None,
        cache_control=None,
        content_disposition=None,
        content_length_range=None,
        server_side_encryption=None, access_key=None,
        secret_access_key=None,
        token=None,
        expires_in=None,
        extra_conditions=None
):
    """Overridden s3direct method

    Changes in adding custom expiration and forbidding key changing in policy

    """
    if (key and key_start) or (not key and not key_start):
        raise ValueError(
            'Exactly one value of key or key_start should be provided'
        )

    now_date = datetime.utcnow().strftime('%Y%m%dT%H%M%S000Z')
    raw_date = datetime.utcnow().strftime('%Y%m%d')

    bucket = bucket or settings.AWS_STORAGE_BUCKET_NAME
    extra_conditions = extra_conditions or []

    if not expires_in:
        expires_in = timedelta(seconds=60 * 5)

    expires_dt = datetime.utcnow() + expires_in
    expires = expires_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    region = getattr(settings, 'AWS_S3_DIRECT_REGION', None)

    endpoint = get_aws_endpoint(region)

    policy_dict = {
        "expiration": expires,
        "conditions": [
            {"bucket": bucket},
            {"acl": acl},
            # add condition for key to prevent pushing to not allowed
            # folders
            {"success_action_status": '201'},
            {"x-amz-credential": '%s/%s/%s/s3/aws4_request' % (
                access_key,
                raw_date, region
            )},
            {"x-amz-algorithm": "AWS4-HMAC-SHA256"},
            {"x-amz-date": now_date},
        ]
    }
    policy_dict['conditions'] += extra_conditions

    if key_start:
        policy_dict['conditions'].append(['starts-with', '$key', key_start])
    else:
        policy_dict['conditions'].append({'key': key})

    if content_type:
        policy_dict['conditions'].append({"content-type": content_type})

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
        policy_dict['conditions'].append([
            'content-length-range',
            content_length_range[0],
            content_length_range[1]
        ])

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

    structure = getattr(settings, 'S3DIRECT_URL_STRUCTURE', 'https://{0}/{1}')
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
        "key": key_start or key,
        "acl": acl,
    }

    if content_type:
        return_dict["content-type"] = content_type

    if token:
        return_dict['x-amz-security-token'] = token

    if cache_control:
        return_dict['Cache-Control'] = cache_control

    if content_disposition:
        return_dict['Content-Disposition'] = content_disposition

    return return_dict


def get_aws_endpoint(region) -> str:
    """Get aws bucket endpoint."""
    minio_url = getattr(settings, 'AWS_S3_ENDPOINT_URL')

    if minio_url:
        return minio_url
    if not region or region == 'us-east-1':
        return 's3.amazonaws.com'
    return f's3-{region}.amazonaws.com'
