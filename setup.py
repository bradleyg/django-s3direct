import os
from setuptools import setup

f = open(os.path.join(os.path.dirname(__file__), 'README.md'))
readme = f.read()
f.close()

setup(
    name='django-s3direct',
    version='1.0.1.dev1',
    description=('Add direct uploads to S3 functionality with a progress bar'
                 ' to file input fields.'),
    long_description=readme,
    author="Bradley Griffiths",
    author_email='bradley.griffiths@gmail.com',
    url='https://github.com/bradleyg/django-s3direct',
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
