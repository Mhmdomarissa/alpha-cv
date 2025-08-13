# 🚀 CV Analyzer Frontend

**Enterprise-grade AI-powered recruitment platform frontend built with Next.js 15**

## ✨ Features

### 🎯 **Core Functionality**
- **AI-Powered Analysis**: Real-time CV and job description matching with GPT-4 integration
- **Intelligent File Upload**: Drag-and-drop support for multiple file formats (PDF, DOCX, TXT, Images)
- **Advanced Matching**: Vector similarity scoring with detailed breakdowns
- **Document Management**: Full database of stored CVs and job descriptions
- **Real-time Results**: Interactive results dashboard with detailed scoring

### 🎨 **Modern UI/UX**
- **Enterprise Design**: Professional interface matching Fortune 500 standards
- **Responsive Layout**: Perfect on desktop, tablet, and mobile devices
- **Smooth Animations**: Framer Motion powered micro-interactions
- **Accessibility First**: WCAG compliant with keyboard navigation support
- **Dark Mode Ready**: Infrastructure prepared for dark theme

### ⚡ **Performance & Technology**
- **Next.js 15**: Latest React framework with App Router
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first styling with custom design system
- **Zustand**: Lightweight state management
- **React Query**: Efficient API state management with caching
- **Production Ready**: Optimized for enterprise deployment

## 🛠️ **Technology Stack**

### **Frontend Framework**
- Next.js 15 with App Router
- React 19 with TypeScript
- Tailwind CSS with custom design system

### **State Management**
- Zustand for global state
- React Query for API state
- Local storage persistence

### **UI Components**
- Custom component library
- Headless UI primitives
- Heroicons for consistent iconography
- Framer Motion for animations

### **File Handling**
- React Dropzone for uploads
- Multi-format support (PDF, DOCX, TXT, Images)
- Progress tracking and validation
- Drag-and-drop interface

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Backend API running at `http://51.20.121.68:8000`

### **Installation**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

### **Environment Setup**
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://13.61.179.54:8000
NEXT_PUBLIC_APP_NAME=CV Analyzer
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 📱 **Application Structure**

### **Main Pages**
1. **Upload & Analysis** (`/`)
   - Job description input (file upload or text paste)
   - CV bulk upload with progress tracking
   - AI analysis with real-time progress
   - Animated loading states

2. **Database Management** (`/database`)
   - View all stored CVs and job descriptions
   - Search and filter functionality
   - Document preview and management
   - Bulk operations support

3. **Results Dashboard** (`/results`)
   - Ranked candidate matching results
   - Detailed scoring breakdowns (Skills, Experience, Education, Title)
   - Interactive candidate profiles
   - Export and sharing capabilities

### **Key Components**

#### **FileUpload Component**
- Drag-and-drop interface
- Multi-file support with progress tracking
- File validation and error handling
- Preview and remove functionality

#### **Layout System**
- Responsive navigation header
- Real-time system status indicator
- Contextual action buttons
- Professional footer

#### **Results Display**
- Score visualization with progress bars
- Color-coded performance indicators
- Detailed candidate breakdowns
- Export and comparison tools

## 🎨 **Design System**

### **Color Palette**
- **Primary**: Blue scale for actions and highlights
- **Secondary**: Gray scale for text and backgrounds  
- **Success**: Green for positive states
- **Warning**: Orange for cautionary states
- **Error**: Red for error states

### **Typography**
- **Font**: Inter (optimized for readability)
- **Scales**: Consistent heading and text sizing
- **Weights**: 300-800 range for hierarchy

### **Components**
- **Buttons**: 5 variants, 4 sizes with loading states
- **Cards**: Elevated surfaces with hover effects
- **Forms**: Accessible inputs with validation
- **Progress**: Animated bars with color coding
- **Badges**: Status indicators with semantic colors

## 🔌 **API Integration**

### **Backend Connection**
- Full integration with CV matching API at `http://13.61.179.54:8000`
- Health monitoring and status checking
- Error handling with graceful degradation
- Mock data fallbacks for offline development

### **Key Endpoints**
- `GET /health` - System health check
- `GET /api/upload/system-status` - Detailed system stats
- `POST /api/jobs/standardize-and-match-text` - Main analysis endpoint
- `GET /api/upload/list-cvs` - CV database listing
- `GET /api/jobs/list-jds` - Job description listing

## 📊 **Performance Features**

### **Optimization**
- **Bundle Splitting**: Automatic code splitting
- **Image Optimization**: Next.js optimized images
- **Caching Strategy**: React Query with stale-while-revalidate
- **Lazy Loading**: Components loaded on demand

### **Monitoring**
- Real-time system status display
- API response time tracking
- Error boundary protection
- Performance metrics collection

## 🔧 **Development Features**

### **Developer Experience**
- **Hot Reload**: Instant development feedback
- **TypeScript**: Full type safety and IntelliSense
- **ESLint**: Code quality enforcement
- **Error Boundaries**: Graceful error handling

### **Production Ready**
- **Environment Configuration**: Multiple environment support
- **Build Optimization**: Production-optimized builds
- **SEO Ready**: Meta tags and Open Graph support
- **Accessibility**: WCAG 2.1 AA compliance

## 🎯 **Key Features Highlights**

### **Enterprise-Grade Quality**
✅ **Professional Design** - Matches industry-leading applications  
✅ **Performance Optimized** - Sub-second load times  
✅ **Fully Responsive** - Perfect on all device sizes  
✅ **Accessibility Compliant** - WCAG 2.1 AA standards  
✅ **Type Safe** - 100% TypeScript coverage  
✅ **Production Ready** - Scalable and maintainable  

### **Advanced Functionality**
✅ **Real-time Analysis** - Live progress tracking  
✅ **Intelligent Matching** - AI-powered scoring  
✅ **File Management** - Complete document handling  
✅ **Data Visualization** - Interactive results display  
✅ **Error Handling** - Comprehensive error management  
✅ **State Management** - Efficient data handling  

## 🌐 **Browser Support**

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📋 **Scripts**

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🚀 **Deployment**

Ready for deployment to:
- Vercel (recommended)
- Netlify
- AWS Amplify
- Custom server with Docker

---

**Built with ❤️ by Senior Frontend Engineer**  
*Enterprise-grade recruitment technology for the modern workplace*