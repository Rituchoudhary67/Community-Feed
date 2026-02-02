from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
import os

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('community.urls')),
]

# In production, serve the React build for any non-API routes
FRONTEND_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'frontend', 'build')
if os.path.exists(os.path.join(FRONTEND_BUILD_DIR, 'index.html')):
    from django.views.static import serve
    from django.urls import re_path
    urlpatterns += [
        re_path(r'^(?!api/)(?!admin/).*$', TemplateView.as_view(template_name='index.html'), name='react-app'),
    ]
