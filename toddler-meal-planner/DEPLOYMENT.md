# Deployment Guide - LittleBowl

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

## Option 4: Docker on Any VPS

Works on DigitalOcean, Linode, Vultr, or any Linux server.

```bash
# Clone repository
git clone https://github.com/swetaattri073/kabirmealplanner.git
cd kabirmealplanner/toddler-meal-planner

# Create environment file
cp .env.example .env
# Edit .env with your settings

# Deploy with Docker Compose
docker-compose up -d --build

# View logs
docker-compose logs -f
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Flask secret key | Random (dev) |
| `DATABASE_URL` | PostgreSQL URL | SQLite (local) |
| `FLASK_ENV` | Environment mode | development |

---

## Updating Your Deployment

### Render/Railway:
Push to GitHub → Auto-deploys

### AWS Lightsail/EC2:
```bash
cd ~/kabirmealplanner
git pull origin main
cd toddler-meal-planner
sudo docker-compose up -d --build
```

### AWS App Runner:
Push to GitHub → GitHub Actions auto-deploys

---

## Troubleshooting

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
