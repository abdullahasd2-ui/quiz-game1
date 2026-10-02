import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAdmin } from './admin/auth';
import { AdminLayout } from './admin/AdminLayout';
import { CategoriesPage } from './admin/pages/CategoriesPage';
import { ImportPage } from './admin/pages/ImportPage';
import { LoginPage } from './admin/pages/LoginPage';
import { OverviewPage } from './admin/pages/OverviewPage';
import { QuestionEditPage } from './admin/pages/QuestionEditPage';
import { QuestionsPage } from './admin/pages/QuestionsPage';
import { GamePage } from './game/GamePage';

export const router = createBrowserRouter([
  { path: '/', element: <GamePage /> },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <RequireAdmin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'questions', element: <QuestionsPage /> },
          { path: 'questions/new', element: <QuestionEditPage /> },
          { path: 'questions/:id', element: <QuestionEditPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'import', element: <ImportPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
