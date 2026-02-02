#!/bin/bash
set -e

# Install backend deps
cd backend
pip install -r requirements.txt

# Install frontend deps & build
cd ../frontend
npm install
npm run build

# Copy React build into backend static serving path
cp -r build ../backend/frontend_build

# Run migrations
cd ../backend
python manage.py migrate --run-syncdb
python manage.py seed_data || true
