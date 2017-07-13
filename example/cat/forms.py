from django import forms

from s3uploads.widgets import S3UploadsWidget


class S3UploadsUploadForm(forms.Form):
    misc = forms.URLField(widget=S3UploadsWidget(dest='misc'))


class S3UploadsUploadMultiForm(forms.Form):
    misc = forms.URLField(widget=S3UploadsWidget(dest='misc'))
    pdfs = forms.URLField(widget=S3UploadsWidget(dest='pdfs'))
    images = forms.URLField(widget=S3UploadsWidget(dest='images'))
    videos = forms.URLField(widget=S3UploadsWidget(dest='videos'))
