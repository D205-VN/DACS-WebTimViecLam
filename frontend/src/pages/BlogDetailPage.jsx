import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Calendar, Clock3, User2 } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { blogPosts, getBlogPostBySlug } from '@shared/content/blogPosts';
import { getBlogDetailRoute, getRouteByRole } from '@shared/utils/roleRedirect';

function formatDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function BlogDetailPage() {
  const { user } = useAuth();
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);
  const blogRoute = getRouteByRole(user?.role_code, 'blog');

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Không tìm thấy bài viết</h1>
          <p className="mt-3 text-sm text-gray-500">Liên kết có thể không còn tồn tại hoặc bài viết chưa được xuất bản.</p>
          <Link
            to={blogRoute}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Quay lại Blog
          </Link>
        </div>
      </div>
    );
  }

  const relatedPosts = blogPosts
    .filter((item) => item.slug !== post.slug && item.category === post.category)
    .slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to={blogRoute} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Quay lại Blog
      </Link>

      <article className="mt-6 overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-sm">
        <div className={`bg-gradient-to-br ${post.color} px-6 py-10 text-white sm:px-8`}>
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            {post.category}
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
          <p className="mt-4 max-w-3xl text-base text-white/85">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <User2 className="w-4 h-4" />
              {post.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(post.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-8">
          <div className="mb-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700">
                #{tag}
              </span>
            ))}
          </div>

          <div className="space-y-10">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-bold text-gray-800">{section.heading}</h2>
                {section.paragraphs ? (
                  <div className="mt-4 space-y-4 text-base leading-8 text-gray-600">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
                {section.bullets ? (
                  <ul className="mt-4 space-y-3 text-base leading-8 text-gray-600">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-navy-500"></span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </article>

      {relatedPosts.length ? (
        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-800">Bài viết cùng chủ đề</h2>
            <p className="mt-1 text-sm text-gray-500">Đọc thêm để hoàn thiện hồ sơ và quá trình ứng tuyển.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {relatedPosts.map((item) => (
              <Link
                key={item.slug}
                to={getBlogDetailRoute(user?.role_code, item.slug)}
                className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy-100/40"
              >
                <div className={`h-28 bg-gradient-to-br ${item.color} p-5 text-white`}>
                  <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                    <BookOpen className="mr-1 inline h-3.5 w-3.5" />
                    {item.category}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold leading-snug text-gray-800">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{item.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
