# VM Deploy

## Files On Server

- `docker-compose.yml` should live next to the root `.env`
- copy `.env.example` to `.env` and fill in your local values
- do not commit the `.env` file or any Google credential JSON

## Google Credentials

- If you use a JSON key, keep it outside the repo and mount it into the backend container
- Set `GOOGLE_APPLICATION_CREDENTIALS` to the mounted path
- You can also rely on Application Default Credentials if the VM is already configured that way

## First Deploy Or Refresh Images

```bash
docker compose pull
docker compose up -d --build
docker compose ps
```

## Health Checks

```bash
curl http://localhost:8443/api/health
curl http://localhost/api/health
curl http://localhost/
```

## Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Notes

- Port `8443` in this stack is plain HTTP unless you add a reverse proxy or TLS terminator.
- The frontend does not need its own `.env`; Ver2Page falls back to the backend URL automatically.
- `.dockerignore` files keep `.env`, credential JSON, uploads, and build artifacts out of the images.
