from django.conf.urls import include, url
from django.contrib import admin

admin.autodiscover()

app_name = 'example'

urlpatterns = [
    url('^admin/', admin.site.urls),
    url('^s3upload/', include('s3upload.urls')),
    url('^form/', include('cat.urls')),
]
