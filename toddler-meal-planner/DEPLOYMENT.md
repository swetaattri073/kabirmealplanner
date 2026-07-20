# Deployment Guide - LittleBowl (Flask)

> **Production app lives in this folder.** Deploy from `toddler-meal-planner/`.
> The React app at the repo root is optional and is not required for production.

## Quick Comparison

| Method | Difficulty | Cost | Setup Time |
|--------|-----------|------|------------|
| Render.com | ⭐ Easy | Free | 5 min |
| Railway | ⭐ Easy | Free/$5 | 5 min |
| AWS Lightsail (Manual) | ⭐⭐ Medium | $3.50/mo | 15 min |
| AWS App Runner | ⭐⭐ Medium | $5-15/mo | 20 min |
| AWS EC2 | ⭐⭐⭐ Advanced | $0-10/mo | 30 min |

---

## Option 1: Render.com (Recommended for Beginners)

### Steps:
1. Go to [render.com](https://render.com) and sign up
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select repository: `swetaattri073/kabirmealplanner`
5. Configure:
   - **Root Directory**: `toddler-meal-planner`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
6. Click **"Create Web Service"**
7. Wait 3-5 minutes for deployment
8. Your app is live at `https://your-app.onrender.com`

### Adding a Database (for production):
1. In Render, create a **PostgreSQL** database (free tier available)
2. Copy the **Internal Database URL**
3. Add environment variable: `DATABASE_URL` = your database URL

---

## Option 2: AWS Lightsail (Manual - No Credentials Sharing)

### Step 1: Create Lightsail Instance

1. Log into [AWS Console](https://console.aws.amazon.com)
2. Go to **Lightsail** service
3. Click **"Create instance"**
4. Choose:
   - **Region**: Your preferred region (ap-south-1 for India)
   - **Platform**: Linux/Unix
   - **Blueprint**: Amazon Linux 2023
   - **Instance plan**: $3.50/month (512 MB)
5. Name it `meal-planner`
6. Click **"Create instance"**

### Step 2: Connect and Deploy

1. Click on your instance → **"Connect using SSH"**
2. Run these commands:

```bash
# Update and install Docker
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone and deploy
git clone https://github.com/swetaattri073/kabirmealplanner.git
cd kabirmealplanner/toddler-meal-planner

# Create production environment
cat > .env << 'EOF'
FLASK_ENV=production
SECRET_KEY=$(openssl rand -hex 32)
EOF

# Build and run
sudo docker-compose up -d --build
```

### Step 3: Configure Networking

1. Go to your instance → **"Networking"** tab
2. Under **"IPv4 Firewall"**, add rule:
   - **Application**: HTTP (port 80)
3. Note your **Public IP address**
4. Access your app at `http://YOUR_PUBLIC_IP`

### Step 4: (Optional) Add Custom Domain + HTTPS

```bash
# Install Certbot for free SSL
sudo yum install -y certbot python3-certbot-nginx nginx

# Configure Nginx as reverse proxy
sudo cat > /etc/nginx/conf.d/meal-planner.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo systemctl start nginx
sudo systemctl enable nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

---

## Option 3: AWS App Runner (Automated Deployments)

### One-Time Setup in AWS Console:

#### Step 1: Create ECR Repository
1. Go to **ECR** in AWS Console
2. Click **"Create repository"**
3. Name: `toddler-meal-planner`
4. Click **"Create"**

#### Step 2: Set Up OIDC for GitHub Actions
1. Go to **IAM** → **Identity providers**
2. Click **"Add provider"**
3. Choose **OpenID Connect**
4. Provider URL: `https://token.actions.githubusercontent.com`
5. Audience: `sts.amazonaws.com`
6. Click **"Add provider"**

#### Step 3: Create IAM Role for GitHub
1. Go to **IAM** → **Roles** → **"Create role"**
2. Choose **"Web identity"**
3. Identity provider: `token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Add condition:
   - Key: `token.actions.githubusercontent.com:sub`
   - Condition: `StringLike`
   - Value: `repo:swetaattri073/kabirmealplanner:*`
6. Attach policies:
   - `AmazonEC2ContainerRegistryPowerUser`
   - `AWSAppRunnerFullAccess`
7. Name: `github-actions-meal-planner`
8. Note the **Role ARN**

#### Step 4: Create App Runner Service
1. Go to **App Runner** in AWS Console
2. Click **"Create service"**
3. Choose **"Container registry"** → **"Amazon ECR"**
4. Browse to your ECR repository
5. Configure:
   - Port: `5000`
   - CPU: 0.25 vCPU
   - Memory: 0.5 GB
6. Click **"Create & deploy"**
7. Note the **Service ARN**

#### Step 5: Configure GitHub Secrets
In your GitHub repo → Settings → Secrets:
- `AWS_ROLE_ARN`: The IAM role ARN from Step 3
- `APP_RUNNER_SERVICE_ARN`: The App Runner service ARN from Step 4

Now every push to `main` will auto-deploy!

---

## Option 4: Docker on Any VPS (recommended)

Works on DigitalOcean, Linode, Vultr, Lightsail, or any Linux server.

```bash
cd ~/kabirmealplanner && git pull origin main
cd toddler-meal-planner

# One-time: persistent secrets next to the DB (survives docker rebuild/rm)
mkdir -p ~/meal-data
cp -n .env.example ~/meal-data/.env
# edit ~/meal-data/.env — set OPENAI_API_KEY=sk-... and SECRET_KEY=...

sudo docker build -t meal-planner .
sudo docker stop meal-planner 2>/dev/null; sudo docker rm meal-planner 2>/dev/null
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  --env-file ~/meal-data/.env \
  meal-planner
```

Or with Compose (mounts `~/meal-data`; app also reads `/app/instance/.env` from that volume):

```bash
cd ~/kabirmealplanner/toddler-meal-planner
mkdir -p ~/meal-data
cp -n .env.example ~/meal-data/.env   # then edit OPENAI_API_KEY=...
docker compose up -d --build
```

Open `http://YOUR_PUBLIC_IP`.

**Data persistence (important):** Keep both the database and secrets under `~/meal-data`:

| Host path | Inside container | Purpose |
|-----------|------------------|---------|
| `~/meal-data/toddler_meals.db` | `/app/instance/toddler_meals.db` | Users, toddlers, meal logs, plans |
| `~/meal-data/.env` | `/app/instance/.env` | `OPENAI_API_KEY`, `SECRET_KEY`, etc. |

The `-v ~/meal-data:/app/instance` mount keeps **all of that** across rebuilds. The app loads `/app/instance/.env` on startup (and `docker run --env-file ~/meal-data/.env` also injects those vars). Do not delete `~/meal-data` unless you want a full wipe.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Flask secret key | Random (dev) |
| `DATABASE_URL` | SQLite/Postgres URL | `sqlite:////app/instance/toddler_meals.db` in Docker |
| `OPENAI_API_KEY` | Chat assistant (from `.env`) | unset → chat disabled |
| `OPENAI_CHAT_MODEL` | Chat model override | `gpt-4o-mini` |
| `FEATURE_CHAT_ENABLED` | Enable Premium chat UI/API | `false` (hidden by default) |
| `ADMIN_EMAILS` | Emails allowed on `/admin` login (comma-separated) | empty (disabled) |
| `ADMIN_PASSWORD` | Shared password for `/admin` login | empty (disabled) |
| `USDA_FDC_API_KEY` | Optional USDA lookups | DEMO_KEY |
| `SESSION_COOKIE_SECURE` | `true` only behind HTTPS | unset/false for HTTP IP access. **Never set `true` on plain `http://` IP deploys** — cookies won't stick on phones and onboarding will reset. |
| `SECRET_KEY` | Flask sessions / cookies | Auto-generated into `~/meal-data/.env` on first boot if missing — keep the volume so it does not change on redeploy |
| `FLASK_ENV` | Environment mode | production (Docker) |

Put secrets in **`~/meal-data/.env`** (same folder as the DB). Pass them with `--env-file ~/meal-data/.env`, and/or rely on the app loading `/app/instance/.env` from the volume.

Auth is email/password only (social login removed). Chat is Premium-only and off until `FEATURE_CHAT_ENABLED=true`. Admin dashboard: set both `ADMIN_EMAILS` and `ADMIN_PASSWORD`, then open `/admin` and sign in there (not linked in the parent UI; incomplete config returns 404).

Do not put API keys in `docker run -e` flags, and do not keep production secrets only inside the git checkout (that can be wiped on a fresh clone).

---

## Updating Your Deployment

### Render/Railway:
Push to GitHub → Auto-deploys

### AWS Lightsail/EC2 / any Docker host:
```bash
cd ~/kabirmealplanner
git pull origin main
cd toddler-meal-planner
# Secrets live in ~/meal-data/.env (persists across redeploys)
sudo docker build -t meal-planner .
sudo docker stop meal-planner && sudo docker rm meal-planner
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  --env-file ~/meal-data/.env \
  meal-planner
```
### AWS App Runner:
Push to GitHub → GitHub Actions auto-deploys

---

## Troubleshooting

### Onboarding keeps showing after you already created a profile?
Usually the guest session cookie was lost (common on phone PWAs, or when `SESSION_COOKIE_SECURE=true` on plain HTTP).

1. Confirm `~/meal-data/.env` has a stable `SECRET_KEY` and is mounted via `-v ~/meal-data:/app/instance`.
2. On HTTP IP access, set `SESSION_COOKIE_SECURE=false` (or omit it). Only use `true` behind real HTTPS.
3. Create a free account (Sign up) so the toddler is tied to your login — that survives cookie clears and reinstalls.
4. Redeploy this app version: `/home` restores guest id from localStorage before sending you to onboarding.

### App not loading?
```bash
# Check if container is running
docker ps

# View logs
docker-compose logs web

# Restart
docker-compose restart
```

### Database errors?
```bash
# Reset database
docker-compose exec web python3 -c "from app import db; db.drop_all(); db.create_all()"
```

### Port already in use?
```bash
# Find and kill process
sudo lsof -i :5000
sudo kill -9 <PID>
```
