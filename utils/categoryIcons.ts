
/**
 * Utilitário inteligente para mapear nomes de categorias para ícones do Material Symbols.
 * Suporta correspondência parcial e normalização de texto.
 */

const iconMap: Record<string, string> = {
  // --- ALIMENTAÇÃO & BEBIDAS ---
  'alimentos': 'restaurant',
  'bebidas': 'local_bar',
  'restaurante': 'restaurant',
  'ifood': 'delivery_dining',
  'delivery': 'delivery_dining',
  'lanche': 'fastfood',
  'burger': 'lunch_dining',
  'pizza': 'local_pizza',
  'padaria': 'bakery_dining',
  'doce': 'icecream',
  'cafe': 'coffee',
  'mercado': 'shopping_cart',
  'supermercado': 'store',
  'açougue': 'kebab_dining',

  // --- TRANSPORTE & VEÍCULOS ---
  'transporte': 'directions_bus',
  'uber': 'directions_car',
  '99': 'directions_car',
  'taxi': 'local_taxi',
  'carro': 'directions_car',
  'veiculo': 'directions_car',
  'moto': 'two_wheeler',
  'combustivel': 'local_gas_station',
  'gasolina': 'local_gas_station',
  'etanol': 'local_gas_station',
  'estacionamento': 'local_parking',
  'manutencao veiculo': 'build',
  'oficina': 'home_repair_service',
  'pedagio': 'toll',
  'multa': 'gavel',
  'licenciamento': 'description',
  'ipva': 'directions_car',
  'financiamento veiculo': 'car_rental',
  'vale combustivel': 'local_gas_station',

  // --- CASA & MORADIA ---
  'casa': 'home',
  'moradia': 'home',
  'aluguel': 'real_estate_agent',
  'condominio': 'apartment',
  'energia': 'bolt',
  'luz': 'lightbulb',
  'agua': 'water_drop',
  'gas': 'propane',
  'internet': 'router',
  'telefonia': 'smartphone',
  'celular': 'phone_iphone',
  'tv': 'tv',
  'streaming': 'movie',
  'netflix': 'movie',
  'disney': 'movie',
  'hbo': 'movie',
  'spotify': 'music_note',
  'limpeza': 'cleaning_services',
  'utensilios': 'flatware',
  'moveis': 'chair',

  // --- SAÚDE & BEM-ESTAR ---
  'saude': 'medical_services',
  'medico': 'health_and_safety',
  'hospital': 'local_hospital',
  'clinica': 'vaccines',
  'laboratorio': 'biotech',
  'farmacia': 'medication',
  'drogaria': 'medication',
  'dentista': 'dentistry',
  'terapia': 'psychology',
  'academia': 'fitness_center',
  'treino': 'exercise',
  'beleza': 'face',
  'estetica': 'spa',
  'barbearia': 'content_cut',
  'cabelo': 'content_cut',
  'otica': 'visibility',
  'cuidados pessoais': 'self_care',

  // --- COMPRAS & ESTILO ---
  'compras': 'shopping_bag',
  'loja': 'storefront',
  'shopping': 'mall',
  'vestuario': 'checkroom',
  'roupa': 'checkroom',
  'calcado': 'ice_skating',
  'eletronicos': 'devices',
  'presente': 'featured_seasonal_and_gifts',
  'brinquedo': 'toys',
  'cigarro': 'smoking_rooms',

  // --- EDUCAÇÃO ---
  'educacao': 'school',
  'escola': 'school',
  'faculdade': 'history_edu',
  'universidade': 'account_balance',
  'curso': 'menu_book',
  'livro': 'book',
  'papelaria': 'draw',

  // --- LAZER & ENTRETENIMENTO ---
  'lazer': 'sports_esports',
  'game': 'videogame_asset',
  'jogo': 'casino',
  'cinema': 'theaters',
  'viagem': 'flight',
  'hospedagem': 'hotel',
  'hotel': 'bed',
  'ferias': 'beach_access',
  'recreacao': 'local_activity',

  // --- FINANCEIRO & RECEITAS ---
  'salario': 'payments',
  'pagamento': 'receipt_long',
  'freelance': 'laptop_mac',
  'bonus': 'military_tech',
  'comissao': 'trending_up',
  'investimento': 'show_chart',
  'aplicacao': 'monitoring',
  'dividendo': 'pie_chart',
  'juros': 'percent',
  'cashback': 'currency_exchange',
  'reembolso': 'undo',
  'pix': 'sync_alt',
  'transferencia': 'swap_horiz',
  'resgate': 'move_to_inbox',
  'poupanca': 'savings',
  'imposto': 'account_balance',
  'taxa': 'gavel',
  'tarifa': 'credit_card',

  // --- PETS ---
  'pet': 'pets',
  'cachorro': 'dog',
  'gato': 'cat',
  'veterinario': 'medical_information',

  // --- FAMÍLIA & OUTROS ---
  'mae': 'family_restroom',
  'filho': 'child_care',
  'lucca': 'child_friendly',
  'familia': 'diversity_3',
  'doacao': 'volunteer_activism',
  'servicos': 'home_repair_service',
  'servicos digitais': 'cloud',
};

export const getIconByCategoryName = (name: string): string => {
  const normalized = name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Busca exata primeiro
  if (iconMap[normalized]) return iconMap[normalized];

  // Busca por palavras-chave contidas
  for (const key in iconMap) {
    if (normalized.includes(key)) {
      return iconMap[key];
    }
  }

  return 'category'; // Fallback final
};
