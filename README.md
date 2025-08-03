応募者管理システム (Applicant Management System)
概要 (Overview)
このプロジェクトは、採用プロセスにおける応募者の管理を効率化するためのシンプルなウェブアプリケーションです。応募者の情報、応募職種、設問、面接メモ、ステータスを「センター」ごとに一元管理し、採用チームがスムーズに選考を進められるように設計されています。

現在の機能 (Current Features)
管理者機能 (Administrator Features)
ユーザー管理: スーパー管理者は、新しいユーザー（センター管理者、面接官、応募者など）を作成、編集、削除できます。ユーザーにアクセス権のある「センター」を割り当てることが可能です。

センター管理: 採用活動を行う「センター」を登録、編集、削除できます。これにより、各センターの採用プロセスを独立して管理できます。

応募者・面接管理機能 (Applicant & Interview Management)
応募者情報の登録と一覧表示: センターを選択後、新規応募者の氏名、メールアドレス、応募職種、面接日、ステータスなどの情報を登録し、一覧で確認できます。履歴書ファイルのアップロードも可能です。

応募者情報の編集と削除: 登録済みの応募者情報を編集したり、不要になった情報を削除したりできます。履歴書ファイルが更新された場合、古いファイルは自動的に削除されます。

募集職種の管理: センターごとに募集中の職種を追加、編集、削除できます。これにより、応募者が選択できる職種を最新の状態に保てます。

設問管理: センターごとに、各職種に関連する面接設問を管理できます。面接時に必要な質問事項を事前に設定・整理するのに役立ちます。

面接メモ機能: 面接官は、面接中に質問に対する回答や全体的な評価をリアルタイムで記録できます。メモは応募者ごとに紐づけて保存されます。

データ統合 (Data Integration)
センターごとのデータフィルタリング: アプリケーション全体で、選択されたセンターに関連する情報（応募者、職種、設問）のみが表示されます。

使用技術 (Technologies Used)
フロントエンド: Vue.js (Composition API with <script setup>)

状態管理: Pinia

バックエンド: Firebase (Firestore, Authentication, Storage)

セキュリティ: Firebase Security Rules, Firebase Cloud Functions

使用方法 (How to Use)
<details>
<summary>プロジェクトのセットアップ</summary>

ステップ1: 依存関係のインストール
プロジェクトのルートディレクトリに移動し、必要なパッケージをインストールします。

npm install

ステップ2: Firebaseの設定
Firebaseプロジェクトを作成し、Firestore、Authentication、Storageを有効にします。次に、srcディレクトリのfirebaseConfig.jsファイルにFirebaseの設定を追加します。

ステップ3: Cloud Functionsのデプロイ
functionsディレクトリに移動し、Cloud Functionsをデプロイします。

cd functions
npm install
cd ..
firebase deploy --only functions

</details>

<details>
<summary>アプリケーションの実行</summary>

プロジェクトのルートディレクトリに移動し、開発サーバーを起動します。

npm run dev

</details>

貢献 (Contribution)
このプロジェクトへの貢献を歓迎します！



English Version:
Applicant Management System
Overview
This project is a simple web application designed to streamline the management of applicants in the recruitment process. It is structured to centrally manage applicant information, job positions, interview questions, notes, and statuses on a "per-center" basis, allowing recruitment teams to proceed with evaluations smoothly.

Current Features
Administrator Features
User Management: Super admins can create, edit, and delete new users (such as center admins, interviewers, and applicants). It is possible to assign which "centers" a user has access to.

Center Management: You can register, edit, and delete "centers" where recruitment activities take place, allowing for independent management of each center's hiring process.

Applicant & Interview Management
Applicant Registration and List View: After selecting a center, you can register new applicant information such as name, email, applied position, interview date, and status. It also supports uploading resume files.

Editing and Deleting Applicant Information: You can edit registered applicant information or delete unnecessary data. When a resume file is updated, the old file is automatically deleted.

Job Position Management: You can add, edit, and delete open job positions for each center. This helps keep the list of available positions up to date for applicants to choose from.

Interview Question Management: You can manage interview questions related to each job position on a per-center basis. This helps in pre-setting and organizing the necessary questions for interviews.

Interview Notes Feature: Interviewers can record answers to questions and overall evaluations in real-time. Notes are saved and linked to each applicant.

Data Integration
Per-Center Data Filtering: Throughout the application, only information related to the currently selected center (applicants, positions, questions) is displayed.

Technologies Used
Frontend: Vue.js (Composition API with <script setup>)

State Management: Pinia

Backend: Firebase (Firestore, Authentication, Storage)

Security: Firebase Security Rules, Firebase Cloud Functions

How to Use
<details>
<summary>Setup Instructions</summary>

Step 1: Install Dependencies
Navigate to the project's root directory and install the required packages.

npm install

Step 2: Configure Firebase
Create a Firebase project, enable Firestore, Authentication, and Storage. Then, add your Firebase configuration to a firebaseConfig.js file in your src directory.

Step 3: Deploy Cloud Functions
Navigate to your functions directory and deploy the Cloud Functions.

cd functions
npm install
cd ..
firebase deploy --only functions

</details>

<details>
<summary>Running the App</summary>

Navigate to the project's root directory and start the development server.

npm run dev

</details>

Contribution
Contributions to this project are welcome!