import{u as q,r as a,s as l}from"./index-2e73d2fc.js";function E(){const{user:e}=q(),[n,u]=a.useState([]),[r,o]=a.useState([]),[c,m]=a.useState(null),[_,f]=a.useState(!0),[g,p]=a.useState(null),S=async()=>{const{data:s,error:t}=await l.from("course_modules").select(`
          id,
          title,
          slug,
          audience,
          summary,
          media_url,
          duration_minutes,
          order_index,
          module_lessons (
            id,
            module_id,
            title,
            slug,
            type,
            content_md,
            media_url,
            order_index
          )
        `).order("order_index",{ascending:!0});if(t)throw t;const i=(s||[]).map(d=>({...d,lessons:(d.module_lessons||[]).sort((x,P)=>(x.order_index??0)-(P.order_index??0))}))??[];u(i)},y=async()=>{if(!e){o([]),m(null);return}const[s,t]=await Promise.all([l.from("user_course_progress").select("id, module_id, lesson_id, status, completed_at, quiz_score").eq("user_id",e.id),l.from("user_academy_summary").select("*").eq("user_id",e.id).maybeSingle()]);if(s.error)throw s.error;if(t.error&&t.error.code!=="PGRST116")throw t.error;o(s.data||[]),m(t.data||null)},h=async()=>{try{f(!0),p(null),await Promise.all([S(),y()])}catch(s){console.error("Failed to load academy data",s),p((s==null?void 0:s.message)||"Failed to load academy content")}finally{f(!1)}};a.useEffect(()=>{h()},[e==null?void 0:e.id]);const w=async(s,t,i,d)=>{await l.rpc("record_lesson_progress",{p_module_slug:s,p_lesson_slug:t,p_status:i,p_quiz_score:d??null}),await y()};return a.useMemo(()=>({modules:n,lessonProgress:r,summary:c,loading:_,error:g,refresh:h,recordProgress:w}),[n,r,c,_,g])}function L(e,n,u){if(!e.length)return"not_started";const r=e.find(o=>o.module_id===n&&(u?o.lesson_id===u:o.lesson_id===null));return(r==null?void 0:r.status)??"not_started"}function R(e,n){return e.lessons.length?e.lessons.every(u=>{const r=n.find(o=>o.lesson_id===u.id);return(r==null?void 0:r.status)==="completed"}):!1}export{L as g,R as i,E as u};
