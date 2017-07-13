from django.views.generic import FormView

from .forms import S3UploadsUploadForm, S3UploadsUploadMultiForm


class MyView(FormView):
    template_name = 'form.html'
    form_class = S3UploadsUploadForm


class MultiForm(FormView):
    template_name = 'form.html'
    form_class = S3UploadsUploadMultiForm
