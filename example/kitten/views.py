from django.shortcuts import render
from django.views.generic import FormView

from .forms import S3DirectUploadForm


class IndexView(FormView):
    template_name = 'form.html'
    form_class = S3DirectUploadForm