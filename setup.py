import os
import io
import json
from setuptools import setup

with io.open(os.path.join(os.path.dirname(__file__), 'README.md'), encoding="utf-8") as f:
    readme = f.read()

with io.open(os.path.join(os.path.dirname(__file__), 'package.json'), encoding="utf-8") as f:
    package = json.loads(f.read())

setup(
    name=package['name'],
    version=package['version'],
    description=package['description'],
    long_description=readme,
    long_description_content_type='text/markdown',
    author=package['author']['name'],
    author_email=package['author']['email'],
    url=package['homepage'],
    packages=['s3direct'],
    include_package_data=True,
    install_requires=['django>=3.0'],
    zip_safe=False,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
    ],
)
