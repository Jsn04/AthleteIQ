import { useEffect } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ 
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.1,
});

export default function TopLoader({ loading }) {
  useEffect(() => {
    if (loading) {
      NProgress.start();
    } else {
      NProgress.done();
    }
    return () => NProgress.done();
  }, [loading]);

  return null;
}
