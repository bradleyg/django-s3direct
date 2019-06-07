import os
import json
from setuptools import setup

f = open(os.path.join(os.path.dirname(__file__), 'README.md'))
readme = f.read()
f.close()

f = open(os.path.join(os.path.dirname(__file__), 'package.json'))
package = json.loads(f.read())
f.close()

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
    install_requires=['django>=1.8'],
    zip_safe=False,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
    ],
)
