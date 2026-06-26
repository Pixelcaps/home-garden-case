import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('./routes/home.tsx'),
  route('gardens', './routes/gardens.tsx'),
  route('gardens/:gardenId', './routes/garden-detail.tsx'),
] satisfies RouteConfig;
