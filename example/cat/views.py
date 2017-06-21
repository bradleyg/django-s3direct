from django.views.generic import FormView

from .forms import S3DirectUploadForm, S3DirectUploadMultiForm


class MyView(FormView):
    template_name = 'form.html'
    form_class = S3DirectUploadForm


class MultiForm(FormView):
    template_name = 'form.html'
    form_class = S3DirectUploadMultiForm
