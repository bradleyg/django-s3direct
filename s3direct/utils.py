
import hashlib
import hmac
from collections import namedtuple

from django.conf import settings

import boto3
from botocore import session
from botocore.client import Config

AWSCredentials = namedtuple(
    'AWSCredentials',
    ['token', 'secret_key', 'access_key']
)


def get_s3direct_destinations():
    """Returns s3direct destinations.

    NOTE: Don't use constant as it will break ability to change at runtime.
    """
    return getattr(settings, 'S3DIRECT_DESTINATIONS', None)


# AWS Signature v4 Key derivation functions. See:
# http://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html#signature-v4-examples-python


def sign(key, message):
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def get_aws_v4_signing_key(key, signing_date, region, service):
    datestamp = signing_date.strftime('%Y%m%d')
    date_key = sign(('AWS4' + key).encode('utf-8'), datestamp)
    k_region = sign(date_key, region)
    k_service = sign(k_region, service)
    k_signing = sign(k_service, 'aws4_request')
    return k_signing


def get_aws_v4_signature(key, message):
    return hmac.new(key, message.encode('utf-8'), hashlib.sha256).hexdigest()


def get_key(key, file_name, dest):
    if hasattr(key, '__call__'):
        fn_args = [
            file_name,
        ]
        args = dest.get('key_args')
        if args:
            fn_args.append(args)
        object_key = key(*fn_args)
    elif key == '/':
        object_key = file_name
    else:
        object_key = '%s/%s' % (key.strip('/'), file_name)
    return object_key


def get_aws_credentials():
    access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
    secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
    if access_key and secret_key:
        # AWS tokens are not created for pregenerated access keys
        return AWSCredentials(None, secret_key, access_key)

    if not session:
        # AWS credentials are not required for publicly-writable buckets
        return AWSCredentials(None, None, None)

    creds = session.get_session().get_credentials()
    if creds:
        return AWSCredentials(creds.token, creds.secret_key, creds.access_key)
    else:
        # Creds are incorrect
        return AWSCredentials(None, None, None)

def get_presigned_url(dest, key, expires_in=3600):
    dest = get_s3direct_destinations().get(dest)

    bucket = dest.get(
        'bucket',
        getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
    )
    region = dest.get(
        'region',
        getattr(settings, 'AWS_S3_REGION_NAME', None)
    )
    endpoint = dest.get(
        'endpoint',
        getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
    )

    s3_client = boto3.client(
        's3',
        endpoint_url=endpoint,
        region_name=region,
        config=Config(signature_version='s3v4')
    )
    response = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': bucket,
            'Key': key,
        },
        ExpiresIn=expires_in
    )

    return response
