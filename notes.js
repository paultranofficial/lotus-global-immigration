window.updateLotusNotes = function(){
 const en=document.documentElement.lang==='en';
 const field=document.querySelector('#field').selectedOptions[0].textContent;
 const destination=document.querySelector('#destination').selectedOptions[0].textContent;
 const text=en?`LOTUS GLOBAL IMMIGRATION\nCONSULTATION PREPARATION NOTES\n\nField: ${field}\nDestination: ${destination}\n\nWhat to prepare:\n- Education and current qualifications\n- Study or work experience\n- Language skills\n- Budget and preferred timeframe\n- Questions about specific programmes\n\nThese are personal notes and have not been sent to Lotus.`:`LOTUS GLOBAL IMMIGRATION\nGHI CHÚ CHUẨN BỊ TƯ VẤN\n\nLĩnh vực: ${field}\nĐiểm đến: ${destination}\n\nTôi cần chuẩn bị:\n- Trình độ học vấn và bằng cấp hiện có\n- Kinh nghiệm học tập hoặc làm việc\n- Khả năng ngoại ngữ\n- Ngân sách và thời điểm mong muốn\n- Câu hỏi về chương trình cụ thể\n\nĐây là ghi chú cá nhân, chưa được gửi đến Lotus.`;
 window.lotusNoteText=text;window.lotusNoteName=en?'lotus-consultation-notes.txt':'hanh-trinh-lotus.txt';
 document.querySelector('#plan-summary').textContent=`${field} · ${destination}`;
 document.querySelector('#plan-result').hidden=false;
};
document.querySelector('#plan-form').addEventListener('submit',event=>{event.preventDefault();window.updateLotusNotes()});

(function(){
 const link=document.querySelector('#download-plan');link.setAttribute('href','#ket-noi');link.setAttribute('role','button');link.removeAttribute('download');
 const inArtifact=!!(window.claude&&window.claude.use);
 let downloads=null;
 const ready=inArtifact?window.claude.use('downloads').then(d=>{downloads=d;}).catch(()=>{}):Promise.resolve();
 function plainDownload(name,text){const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 link.addEventListener('click',async e=>{e.preventDefault();if(!window.lotusNoteText)return;const name=window.lotusNoteName||'hanh-trinh-lotus.txt';
  await ready;
  if(downloads){try{await downloads.save({filename:name,data:new Blob(['\uFEFF'+window.lotusNoteText],{type:'text/plain;charset=utf-8'})});}catch(err){}return;}
  plainDownload(name,window.lotusNoteText);});
})();
