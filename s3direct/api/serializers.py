from django.conf import settings
from rest_framework import serializers

DESTINATION_CHOICES = [
    (destination, destination) for destination in
    settings.S3DIRECT_DESTINATIONS.keys()
]


class S3DirectSerializer(serializers.Serializer):
    """Serializer for validation s3direct uploading fields."""
    dest = serializers.ChoiceField(
        choices=DESTINATION_CHOICES,
        default=settings.DEFAULT_DESTINATION
    )
    filename = serializers.CharField(required=False, allow_null=True)
    content_type = serializers.CharField(required=False)
