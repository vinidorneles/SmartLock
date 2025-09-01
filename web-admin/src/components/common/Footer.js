import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Heart, 
  Shield, 
  HelpCircle, 
  Mail, 
  Phone, 
  ExternalLink,
  Github,
  BookOpen
} from 'lucide-react';

// Utils
import { cn } from '../../utils/helpers';

// =========================================
// COMPONENTE FOOTER
// =========================================
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      {/* Conteúdo Principal do Footer */}
      <div className="px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          
          {/* Lado Esquerdo - Informações */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6">
            {/* Copyright */}
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <span>© {currentYear}</span>
              <span className="font-medium text-gray-700">
                {process.env.REACT_APP_ORGANIZATION_NAME || 'Universidade Federal'}
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span>Feito com</span>
                <Heart className="w-3 h-3 text-red-500" />
                <span>pela equipe de TI</span>
              </span>
            </div>

            {/* Links Úteis */}
            <div className="flex items-center space-x-4 text-sm">
              <Link
                to="/privacy"
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-1 transition-colors duration-200"
              >
                <Shield className="w-3 h-3" />
                <span>Privacidade</span>
              </Link>
              
              <Link
                to="/terms"
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-1 transition-colors duration-200"
              >
                <BookOpen className="w-3 h-3" />
                <span>Termos</span>
              </Link>
              
              <Link
                to="/help"
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-1 transition-colors duration-200"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Ajuda</span>
              </Link>
            </div>
          </div>

          {/* Lado Direito - Contato e Versão */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6">
            
            {/* Informações de Contato */}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <a
                href={`mailto:${process.env.REACT_APP_SUPPORT_EMAIL || 'suporte@universidade.edu.br'}`}
                className="flex items-center space-x-1 hover:text-gray-700 transition-colors duration-200"
                title="Enviar email para suporte"
              >
                <Mail className="w-3 h-3" />
                <span className="hidden sm:inline">Suporte</span>
              </a>
              
              <a
                href="tel:+554133601000"
                className="flex items-center space-x-1 hover:text-gray-700 transition-colors duration-200"
                title="Ligar para suporte"
              >
                <Phone className="w-3 h-3" />
                <span className="hidden sm:inline">(41) 3360-1000</span>
              </a>
            </div>

            {/* Status e Versão */}
            <div className="flex items-center space-x-4 text-xs text-gray-400">
              {/* Status do Sistema */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Sistema Operacional</span>
                </div>
              </div>

              {/* Versão */}
              <div className="flex items-center space-x-1">
                <span>Versão</span>
                <span className="font-medium text-gray-600">
                  {process.env.REACT_APP_VERSION || '1.0.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Status Detalhada (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-50 border-t border-gray-200 px-4 lg:px-6 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>🚀 Modo Desenvolvimento</span>
              <span>API: {process.env.REACT_APP_API_BASE_URL}</span>
              <span>Build: {process.env.NODE_ENV}</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span>React: {React.version}</span>
              <span>Última atualização: {new Date().toLocaleTimeString('pt-BR')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Links Externos para Documentação */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 lg:px-6 py-3">
        <div className="flex flex-wrap items-center justify-center space-x-6 text-xs text-gray-500">
          <a
            href="https://docs.smartlock.university.edu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 hover:text-gray-700 transition-colors duration-200"
          >
            <BookOpen className="w-3 h-3" />
            <span>Documentação</span>
            <ExternalLink className="w-2 h-2" />
          </a>
          
          <a
            href="https://github.com/university/smart-lock-system"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 hover:text-gray-700 transition-colors duration-200"
          >
            <Github className="w-3 h-3" />
            <span>Código Fonte</span>
            <ExternalLink className="w-2 h-2" />
          </a>
          
          <a
            href="https://status.smartlock.university.edu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 hover:text-gray-700 transition-colors duration-200"
          >
            <Shield className="w-3 h-3" />
            <span>Status da API</span>
            <ExternalLink className="w-2 h-2" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;