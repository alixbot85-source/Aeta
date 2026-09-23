/**
 * Components adapted for Aeta from public 21st.dev patterns:
 * - reuno-ui/Crypto Dashboard (dashboard composition + motion)
 * - Berat Berkay Gökdemir/Wallet Card 2 (balance card/actions)
 * - Ravi Katiyar/Asset Card (two-panel asset cards)
 * - Jessi/Glass Real time crypto Chart (glass chart surface)
 * Sources and attribution: docs/21ST_COMPONENTS.md
 */
import {motion} from 'framer-motion';
import {ArrowDownLeft,ArrowUpRight,Eye,EyeOff,Wifi,ShieldCheck} from 'lucide-react';
import {useState,type ReactNode} from 'react';
export function DemoTag({label='DEMO'}:{label?:string}){return <span className="demo-tag"><i/>{label}</span>}
export function GlassPanel({children,className=''}:{children:ReactNode,className?:string}){return <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.35}} className={`glass-panel ${className}`}>{children}</motion.section>}
export function WalletBalanceCard(){const[show,setShow]=useState(true);return <motion.div whileHover={{y:-3}} className="wallet-balance-card"><div className="wallet-orb one"/><div className="wallet-orb two"/><div className="wallet-card-head"><span><ShieldCheck/> کیف پول اصلی</span><DemoTag/></div><div className="wallet-total"><small>موجودی کل تخمینی</small><div><strong>{show?'$0.00':'••••••'}</strong><button onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div><p>داده واقعی موجود نیست · USD</p></div><div className="wallet-card-actions"><button><ArrowDownLeft/>واریز</button><button><ArrowUpRight/>برداشت</button><button><Wifi/>دریافت</button></div></motion.div>}
export function AssetMetricCard({symbol,name,color}:{symbol:string,name:string,color:string}){return <motion.article whileHover={{scale:1.015}} className="asset-metric"><div className="asset-color" style={{background:`linear-gradient(145deg,${color},#101b2a)`}}><i>{symbol[0]}</i><div><b>{symbol}</b><span>{name}</span></div></div><div className="asset-data"><small>موجودی پرتفوی</small><strong>0.000000</strong><span>قیمت: <em>NOT_CONFIGURED</em></span></div></motion.article>}
export function StatTile({icon,title,value,detail,tone='teal'}:{icon:ReactNode,title:string,value:string,detail:string,tone?:string}){return <motion.div whileHover={{y:-2}} className="stat-tile"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div></motion.div>}
