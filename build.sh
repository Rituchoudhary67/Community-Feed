#!/bin/bash
set -e

echo "===== Installing Backend Dependencies ====="
cd backend
pip install -r requirements.txt

echo "===== Installing Frontend Dependencies ====="
cd ../frontend
npm install

echo "===== Building React Frontend ====="
npm run build

echo "===== Copying Frontend Build ====="
mkdir -p ../backend/frontend_build
cp -r build/* ../backend/frontend_build/

echo "===== Running Database Migrations ====="
cd ../backend
python manage.py migrate --noinput

echo "===== Collecting Static Files ====="
python manage.py collectstatic --noinput

echo "===== Seeding Demo Data ====="
python manage.py seed_data || echo "Seed data already exists or failed"

echo "===== Build Complete ====="