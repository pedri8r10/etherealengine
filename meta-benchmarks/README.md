# Ethereal Engine (IR-Engine) Microservices Deployment on MicroK8s

A step-by-step, ready guide for deploying the Ethereal Engine (IR-Engine) metaverse platform using a microservices architecture on MicroK8s, with built-in observability, monitoring, and load testing.




## System Requirements
OS: Ubuntu 20.04+ (recommended, preferably GUI-based for local browser access)
CPU: 4+ cores
RAM: 8GB+ (16GB recommended)
Disk: 50GB+ free
Network: Outbound internet access
Tools: curl, git, kubectl, helm, docker, k6

## Install Docker and Docker-Compose

```bash
Docker is required for building and running container images.
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) stable"
sudo apt update


sudo apt install -y docker-ce docker-ce-cli docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

sudo docker compose version
```

Note: You may need to log out and back in for group changes to take effect.

## Install MicroK8s

```bash
sudo snap install microk8s --classic --channel=1.26/stable
sudo usermod -a -G microk8s $USER
sudo chown -f -R $USER ~/.kube
newgrp microk8s
```

Due to ongoing issues with host storage access in MicroK8s 1.25, it is recommended to use version 1.26 or later.


##  Initial Setup and Start the MariaDB server locally via Docker

### Unzip/Clone the codebase
Begin by extracting the provided codebase archive (zip or tar file) to a desired location on the local machine.
OR

Clone the git repository.


`git clone https://github.com/pedri8r10/etherealengine`


And checkout to metaverse-benchmark branch.
`git checkout metaverse-benchmark`



### Navigate to the project directory
Open a terminal and change into the root directory of the extracted/cloned Ethereal Engine repository:



`cd /path/to/etherealengine`

### Now start the MariaDB containers.

For simplicity, it is recommended to run a MariaDB server locally in Docker containers, outside of the MicroK8s environment.
Running docker-compose up from the top-level '/scripts' directory in the Ethereal Engine directory will start multiple MariaDB containers, along with a Redis server (Redis is not required for core functionality). The following MariaDB instances will be launched:
A development instance on port 3306


A testing instance on port 3305


A MicroK8s/Minikube instance on port 3304


To restart the MicroK8s/Minikube database container after it has been stopped, use:
`docker start etherealengine_minikube_db`



Alternatively, MariaDB can be installed and run directly on the host system without using Docker. In that case, the Helm configuration must be updated with the correct SQL connection settings, and the ./scripts/build_microk8s.sh script may require modification accordingly.


## Start the local file server
When using a local storage provider with MicroK8s instead of a cloud storage solution like AWS S3, a local file server must be running outside of the MicroK8s environment.
To set up the file server:
From the root of the Ethereal Engine directory, install dependencies:




`npm install`

 If npm install encounters issues, use yarn install instead (requires Yarn to be installed).


Once dependencies are installed, navigate to the packages/server directory and start the local file server:




`npm run serve-local-files`

This will start a local file server on port 8642, serving files from the packages/server/upload directory. Files uploaded or accessed via the engine will be stored and served from this location.



## Configure MicroK8s & User Permissions
Check MicroK8s status:
`microk8s status --wait-ready`


Alias kubectl for convenience:
`alias kubectl='microk8s kubectl'`



## Enable MicroK8s Addons
Enable all required MicroK8s services:
`sudo microk8s enable dashboard dns registry host-access ingress rbac hostpath-storage helm3 observability`


observability: Sets up Prometheus, Grafana, and cAdvisor in a dedicated namespace.

## Enable MicroK8s access for local Docker
MicroK8s uses its internal container registry, typically accessible at localhost:32000. To allow Docker to push and pull images from this registry, it must be marked as an insecure registry.
Update the Docker daemon configuration as follows:
Open or create the Docker configuration file at /etc/docker/daemon.json and add the following content:

```bash

{
  "insecure-registries": ["localhost:32000"]
}

```

Save the file and restart the Docker service to apply the changes:



`sudo systemctl restart docker`


## Verify and troubleshoot MicroK8s
Run `sudo microk8s inspect` and check if there are any warnings. It's recommended to fix the warning for MicroK8s to work properly. The following are some of the warnings and their possible fixes:
WARNING: This machine's hostname contains capital letters and/or underscores. This is not a valid name for a Kubernetes node, causing node registration to fail. Please change the machine's hostname or refer to the documentation for more details.
Possible Fix: https://askubuntu.com/a/87687/1558816
WARNING: The memory cgroup is not enabled. The cluster may not be functioning properly. Please ensure cgroups are enabled
Possible Fix: canonical/microk8s#1691 (comment)
WARNING: IPtables FORWARD policy is DROP. Consider enabling traffic forwarding with: sudo iptables -P FORWARD ACCEPT
The change can be made persistent with: sudo apt-get install iptables-persistent
MicroK8s is not running. Use microk8s inspect for a deeper inspection.
Possible Fix: https://lightrun.com/answers/canonical-microk8s-microk8s-is-not-running-microk8sinspect-showing-no-error
Here, this error could be due to conflicting kubectl installations. Use this command to remove kubectl: `sudo rm -rf /usr/local/bin/kubectl`


## Update the system hostfile to point to MicroK8s
To make sure domain-based routing works during local development, the system’s hosts file needs to point specific domains to the local machine.
On Linux, open the hosts file with root permissions:
`sudo gedit /etc/hosts`



Add or update the following line:
`127.0.0.1 local.etherealengine.com api-local.etherealengine.com instanceserver-local.etherealengine.com 00000.instanceserver-local.etherealengine.com 00001.instanceserver-local.etherealengine.com 00002.instanceserver-local.etherealengine.com 00003.instanceserver-local.etherealengine.com`



This tells the system to route these *-local.etherealengine.com domains to 127.0.0.1, where the NGINX ingress controller will handle the traffic and forward it to the right service in MicroK8s.
Be sure to save the file after editing. Root access is required to make changes to this file on most systems.





## Helm Setup & Namespaces
Add Helm repositories:
```bash
helm repo add etherealengine https://helm.etherealengine.org
helm repo add agones https://agones.dev/chart/stable
helm repo add redis https://charts.bitnami.com/bitnami


helm repo update

```

## Install Agones and Redis deployments
After adding the required Helm repositories, start deploying services using Helm charts.
First, confirm that kubectl is set to use the MicroK8s cluster:

`kubectl config current-context`


The output should be microk8s. To check all available contexts:

`kubectl config get-contexts`


The currently active context will have a * next to it in the leftmost column.
Once the context is set correctly, run the following commands from the root of the Ethereal Engine repository:
```bash
helm install -f packages/ops/configs/agones-default-values.yaml agones agones/agones
helm install local-redis redis/redis
```

These commands install Agones and R	edis into the MicroK8s cluster.
To verify the deployments, run:

`kubectl get pods -A`


Within a minute or so, all pods should appear with the Running status.




## Run build_microk8s.sh
With MicroK8s running, execute the following command from the root of the Ethereal Engine repository:
./scripts/build_microk8s.sh


This script builds a Docker image that contains the entire Ethereal Engine codebase. Several build arguments are used during this process:
MariaDB credentials (the MYSQL_* variables) are required by Vite, which builds the client files and uses database info for configuration. Default values are provided if these are not explicitly set.


Environment variables VITE_CLIENT_HOST, VITE_SERVER_HOST, and VITE_INSTANCESERVER_HOST control the domain names for the deployment. By default, these point to (local/api-local/instanceserver-local).etherealengine.com. To use different domains, set these variables accordingly and update the hosts file entries to match.


The build may take up to 15 minutes on the first run, with subsequent builds completing faster thanks to caching.
After the image is built, it will automatically be pushed to the local MicroK8s container registry for deployment.

## Update Helm Values File
The deployment uses a Helm configuration file named local.microk8s.template.values.yaml. This file is included with the codebase and serves as the main configuration for the deployment.
If a local file server is being used (as described earlier), make sure to update the api.fileServer.hostUploadFolder setting in local.microk8s.template.values.yaml. This should point to the full path of the packages/server/upload directory within the Ethereal Engine folder on the local machine. For example:

`/home/<OS_USER_NAME>/<ENGINE_FOLDER>/packages/server/upload`


It is important that this path correctly references the upload folder inside the engine’s packages/server directory to ensure proper file handling.



## Deploy Ethereal Engine Microservices with its Helm Chart
Install Ethereal Engine:
`helm install -f </path/to/local.microk8s.template.values.yaml> -f ./packages/ops/configs/db-refresh-true.values.yaml local etherealengine/etherealengine `



This deployment sets up all the core microservices—including API servers, instance servers, Agones, Redis, and others—as separate pods.
After about a minute, running the following command should show multiple instance servers, API servers, and a client server, all in the Running state:
`kubectl get pods`


If the environment variable `FORCE_DB_REFRESH=true` was used during deployment, the API servers will initialize or reset the database on startup. To prevent the database from being reinitialized every time an API pod restarts, run the following command to update the deployment:
```bash
helm upgrade --reuse-values -f ./packages/ops/configs/db-refresh-false.values.yaml local etherealengine/ethrealengine
```


This configuration file is included with the codebase. After applying it, the API pods will restart without reinitializing the database on boot.

Verify deployment:
```bash
kubectl get pods -n default
kubectl get svc -n default
```


## Accept invalid certs
Since valid SSL certificates are not set up for the local domains, browsers will display security warnings when accessing the application.
To proceed:
Open the browser and navigate to:

 `https://local.etherealengine.com/`
When presented with a warning about an invalid certificate, manually accept the exception to proceed to the login page.
Open the browser’s developer tools and check the Console or Network tabs. Errors related to:

`https://api-local.etherealengine.com`
will appear. Open this URL in a new browser tab and accept the invalid certificate there as well.


Next, navigate to:

`https://local.etherealengine.com/location/default`
Again, check the developer console for errors related to:

`https://instanceserver-local.etherealengine.com`
Open this URL in a new tab and accept its invalid certificate.


Performing these steps ensures that all required local domains are trusted by the browser, allowing the application to function properly during development.




## Observability & Monitoring

As the Observability namespace and its resources are already enabled and deployed with the “microk8s enable” command above, this includes Prometheus, Grafana, and cAdvisor for metrics and dashboards. Now,

Check deployed observability resources:
`kubectl get pods,svc -n observability`

Copy the kube-prom-stack-grafana (deployed as NodePort) service mapped port (something like 30669, etc.) and go to the local browser and navigate to this URL to access the Grafana dashboards of the deployed Kubernetes Cluster.
`http://localhost:30669`


The default user and password for Grafana are:
```bash
User: admin
Pwd: prom-operator
```


## Accessing Services & Dashboards

Make sure a GUI-based Linux OS (like Ubuntu) is installed on the machine where the Ethereal Engine is deployed with MicroK8s.
If the machine is a remote or non-GUI system (e.g., a VM), it’s recommended to install and run a lightweight **Chromium browser**. In this case, an X server must be installed, properly configured, and running to launch the Chromium browser without a full desktop environment. This allows you to access the platform via a browser even on headless systems.

Access in browser:
Ethereal Engine UI:  https://local.etherealengine.com/ and accept the certificates if not done already
Grafana: http://localhost:<microk8s nodeport number e.g. 30669> (default login: admin / prom-operator)

## Load Testing with K6
Prepare K6 test script:

Navigate to etherealengine/meta-benchmarks and run,
`cd load-tests`
`chmod 777 load-test.js`

Example test targets:
https://local.etherealengine.com/location/default
Other scenes: /location/sky-station, etc.
Run load test (e.g., 1000-1500 or more Virtual Users):

Finally, run the k6 tests:
`k6 run ./load-test.js`

If you experience permission errors with this, then go to the root user,
“sudo -i” and run the command again from the same directory.
`k6 run ./load-test.js`



You can also adjust virtual users and duration as needed, and edit the changes in microservices-load.js file.
The script should primarily test GET APIs for metaverse locations.
View results:
CLI output provides real-time stats.
For advanced visualization, output to JSON or navigate to the Grafana dashboards to get the real-time metrics of the microservices setup of the ethereal/ir-engine exposed by the observability namespace.


This directory contains research-specific benchmarking scripts and configurations
used for evaluating microservices vs monolithic deployments of Ethereal Engine.

The core Ethereal Engine source code remains unchanged.

