from django.contrib import admin
from .models import Kitten
from django import forms
from s3direct.widgets import S3DirectFileWidget, S3DirectURLWidget


class KittenAdmin(admin.ModelAdmin):
    file = forms.FileField(S3DirectFileWidget(upload_to='foo'))
    url = forms.URLField(S3DirectURLWidget(upload_to='bar'))


admin.site.register(Kitten, KittenAdmin)
