from django.shortcuts import render
from django.views.generic import FormView

from .forms import S3DirectUploadForm


class MyView(FormView):
    template_name = 'form.html'
    form_class = S3DirectUploadForm