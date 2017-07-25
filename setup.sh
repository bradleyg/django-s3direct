cd /code/example
pip install -r /code/example/requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py runserver 0.0.0.0:8000