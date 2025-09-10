# CV Analyzer Frontend

A modern React application for AI-powered CV-JD matching with explainable results using the Hungarian algorithm.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **React 19** - Latest React version with concurrent features
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI components
- **Zustand** - Lightweight state management
- **Axios** - HTTP client with interceptors
- **Vitest** - Fast unit testing framework

## Features

- 🚀 **File Upload**: Drag & drop interface for CVs and Job Descriptions
- 🗄️ **Database View**: Browse stored documents with metadata and structured data
- 🎯 **Smart Matching**: Hungarian algorithm with explainable AI results
- ⚙️ **Configurable Weights**: Adjust importance of skills, responsibilities, job title, and experience
- 📊 **Detailed Analysis**: Per-candidate breakdowns with assignments and alternatives
- 🏥 **Health Monitoring**: Real-time system status and service health
- 🔍 **Type Safety**: Full TypeScript integration with backend schemas

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_API_URL=https://alphacv.alphadatarecruitment.ae
```

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm or yarn
- Running CV Analyzer backend on port 8000

### Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Production Build

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

## Docker Deployment

### Build and run with Docker:

```bash
# Build the image
docker build -t cv-analyzer-frontend .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://your-domain.com \
  cv-analyzer-frontend
```

### Using Docker Compose:

The frontend is designed to work with the existing `docker-compose.yml` in the project root.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run typecheck` - Run TypeScript compiler check
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main application page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── upload/           # File upload components
│   ├── database/         # Database view components
│   ├── results/          # Matching results components
│   ├── common/           # Shared components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility libraries
│   ├── api.ts           # API client and types
│   ├── types.ts         # TypeScript type definitions
│   ├── config.ts        # Configuration
│   ├── logger.ts        # Logging utility
│   ├── error-handler.ts # Error handling
│   └── utils.ts         # Helper functions
├── stores/              # Zustand state management
│   └── appStore.ts      # Main application store
└── __tests__/           # Test files
    ├── setup.ts         # Test setup
    └── api.test.ts      # API tests
```

## API Integration

The frontend is built to work seamlessly with the FastAPI backend. All API calls are typed and include:

- **Health Monitoring**: `/api/health`
- **File Upload**: `/api/cv/upload-cv`, `/api/jd/upload-jd`
- **Data Retrieval**: `/api/cv/cvs`, `/api/jd/jds`
- **Matching**: `/api/match` (Hungarian algorithm)

## State Management

Uses Zustand for lightweight, performant state management:

- **File Management**: CV/JD upload and storage
- **Matching Configuration**: Weights and parameters
- **Results Display**: Match results and candidate details
- **System Status**: Health monitoring and error states

## Type Safety

All API responses are fully typed based on the backend's Pydantic schemas:

- `MatchRequest` / `MatchResponse`
- `CandidateBreakdown`
- `AssignmentItem` / `AlternativesItem`
- `CVListItem` / `JDListItem`
- `HealthResponse`

## Testing

- **Unit Tests**: Component and utility function tests
- **Type Tests**: Compile-time type safety validation
- **API Integration**: Mock API response testing

Run tests:
```bash
npm test
```

## Contributing

1. Follow TypeScript best practices
2. Use provided UI components from shadcn/ui
3. Maintain type safety throughout
4. Add tests for new functionality
5. Update documentation as needed

## Performance

- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js image optimization
- **Bundle Analysis**: Built-in bundle analyzer
- **Caching**: HTTP caching and request deduplication

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is part of the CV Analyzer system.


$ npm install framer-motion