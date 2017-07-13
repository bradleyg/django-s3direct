from django.views.generic import FormView

from .forms import S3UploadUploadForm, S3UploadUploadMultiForm


class MyView(FormView):
    template_name = 'form.html'
    form_class = S3UploadUploadForm


class MultiForm(FormView):
    template_name = 'form.html'
    form_class = S3UploadUploadMultiForm
