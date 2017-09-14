from django.views.generic import FormView

from .forms import S3UploadForm, S3UploadMultiForm


class MyView(FormView):
    template_name = 'form.html'
    form_class = S3UploadForm


class MultiForm(FormView):
    template_name = 'form.html'
    form_class = S3UploadMultiForm


class AsyncForm(FormView):
    template_name = 'async_form.html'
    form_class = S3UploadForm
