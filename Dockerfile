FROM python:2.7
ENV PYTHONUNBUFFERED 1
RUN mkdir /code
COPY ./setup.sh /code
COPY ./runtests.py /code
WORKDIR /code