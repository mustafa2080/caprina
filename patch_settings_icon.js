const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. أضف Settings للـ imports
c = c.replace(
  'ChevronDown, KeyRound, Warehouse, Megaphone, UserCheck, UserCog, Sun, Moon, Brain, Archive, Clock, MessageCircle, Menu, X, Download, DollarSign, ShoppingCart, ShoppingBag, Receipt, Building2, Wallet, ChevronLeft, Crown',
  'ChevronDown, KeyRound, Warehouse, Megaphone, UserCheck, UserCog, Sun, Moon, Brain, Archive, Clock, MessageCircle, Menu, X, Download, DollarSign, ShoppingCart, ShoppingBag, Receipt, Building2, Wallet, ChevronLeft, Crown, Settings'
);

// 2. غير الأيقونة في NavGroup
c = c.replace(
  '<NavGroup label="الإعدادات والدعم" icon={MessageCircle} iconColor="text-emerald-500"',
  '<NavGroup label="الإعدادات والدعم" icon={Settings} iconColor="text-emerald-500"'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done!');
