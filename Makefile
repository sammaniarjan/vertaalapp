.PHONY: setup dev dev-backend dev-frontend

setup:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	cd frontend && npm install

dev-backend:
	cd backend && .venv/bin/python run.py

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend and frontend..."
	$(MAKE) dev-backend & $(MAKE) dev-frontend & wait
