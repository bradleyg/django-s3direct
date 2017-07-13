from django import forms

from s3upload.widgets import S3UploadWidget


class S3UploadForm(forms.Form):
    misc = forms.URLField(widget=S3UploadWidget(dest='misc'))


class S3UploadMultiForm(forms.Form):
    misc = forms.URLField(widget=S3UploadWidget(dest='misc'))
    pdfs = forms.URLField(widget=S3UploadWidget(dest='pdfs'))
    images = forms.URLField(widget=S3UploadWidget(dest='images'))
    videos = forms.URLField(widget=S3UploadWidget(dest='videos'))
