import hashlib
import hmac

from django.conf import settings


def get_at(index, t):
    try:
        value = t[index]
    except IndexError:
        value = None
    return value


# NOTE: Don't use constant as it will break ability to change at runtime
# (E.g. tests)
def get_s3direct_destinations():
    """Returns s3direct destinations, converting old format if necessary."""
    destinations = getattr(settings, 'S3DIRECT_DESTINATIONS', None)
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
                    converted_destinations[dest][key_name] = get_at(
                            index, dest_value)
            else:
                converted_destinations[dest] = dest_value
    return converted_destinations


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
