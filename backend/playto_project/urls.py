from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
import os

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('community.urls')),
]

# Serve React app for all non-API routes
FRONTEND_BUILD_DIR = os.path.join(settings.BASE_DIR, 'frontend_build')
if os.path.exists(os.path.join(FRONTEND_BUILD_DIR, 'index.html')):
    urlpatterns += [
        re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='react-app'),
    ]