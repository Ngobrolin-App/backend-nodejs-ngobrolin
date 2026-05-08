pipeline {
    agent any

    stages {

        stage('Check Environment') {
            steps {
                sh 'whoami'
                sh 'pwd'
                sh 'node -v'
                sh 'npm -v'
            }
        }

        stage('Clone Repository') {
            steps {
                git branch: 'main',
                credentialsId: 'github-yudhah52 ',
                url: 'https://github.com/Ngobrolin-App/backend-nodejs-ngobrolin.git'
            }
        }

        stage('List Files') {
            steps {
                sh 'ls -la'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Restart PM2') {
            steps {
                sh 'sudo -u yudhah52 pm2 restart ngobrolin-app'
            }
        }

    }
}
