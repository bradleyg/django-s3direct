from django import forms
from s3direct.widgets import S3DirectFileWidget, S3DirectURLWidget


class KittenForm(forms.ModelForm):
    file = forms.FileField(S3DirectFileWidget(upload_to='foo'))
    url = forms.URLField(S3DirectURLWidget(upload_to='bar'))