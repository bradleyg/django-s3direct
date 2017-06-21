from django import forms

from s3direct.widgets import S3DirectWidget


class S3DirectUploadForm(forms.Form):
    misc = forms.URLField(widget=S3DirectWidget(dest='misc'))


class S3DirectUploadMultiForm(forms.Form):
    misc = forms.URLField(widget=S3DirectWidget(dest='misc'))
    pdfs = forms.URLField(widget=S3DirectWidget(dest='pdfs'))
    images = forms.URLField(widget=S3DirectWidget(dest='images'))
    videos = forms.URLField(widget=S3DirectWidget(dest='videos'))
